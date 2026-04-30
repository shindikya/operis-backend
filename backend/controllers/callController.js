const supabase = require('../config/supabase');
const { buildVapiContext } = require('../utils/vapiContext');
const { handleError } = require('../utils/errorHandler');
const { sendSms } = require('../services/smsService');
const {
  DEFAULT_TIMEZONE,
  detectOutcomeFromTranscript,
  resolveOutcome,
  isAfterHours,
  wasConcurrent,
  estimateBookingValue,
  recomputeMonthlySummary
} = require('../services/attributionService');
const webhookRetry = require('../services/webhookRetryService');

// Pull a transcript string out of a Vapi end-of-call payload, defensively —
// the field has lived in different places across Vapi versions.
function extractTranscript(message) {
  if (!message) return '';
  if (typeof message.transcript === 'string')          return message.transcript;
  if (typeof message.artifact?.transcript === 'string') return message.artifact.transcript;
  const msgs = message.artifact?.messages || message.call?.messages;
  if (Array.isArray(msgs)) {
    return msgs
      .map(m => (typeof m?.message === 'string' ? m.message : m?.content))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

// Helper — returns TwiML with a spoken message then hangs up
function twimlSay(message) {
  return `<Response><Say>${message}</Say><Hangup/></Response>`;
}

// POST /call/inbound — Twilio webhook (application/x-www-form-urlencoded)
async function handleInbound(req, res) {
  res.type('text/xml');

  const { To: toNumber, From: fromNumber } = req.body;

  if (!toNumber || !fromNumber) {
    return res.status(400).send('<Response><Hangup/></Response>');
  }

  try {
    // 1. Look up phone_numbers by the called number
    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('id, business_id, vapi_agent_id, status')
      .eq('number', toNumber)
      .maybeSingle();

    if (!phoneRecord) {
      return res.send(twimlSay('This number is not in service.'));
    }

    if (phoneRecord.status !== 'active') {
      return res.send(twimlSay('This number is temporarily unavailable.'));
    }

    // 2. Load business
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, profession, timezone')
      .eq('id', phoneRecord.business_id)
      .single();

    if (!business) {
      console.error('No business found for phone_number business_id:', phoneRecord.business_id);
      return res.send(twimlSay('This number is not in service.'));
    }

    // 3. Look up client by caller phone + business
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, phone, total_sessions, notes, tags')
      .eq('business_id', business.id)
      .eq('phone', fromNumber)
      .maybeSingle();

    // 4. Load last 5 bookings if client is known
    let lastBookings = [];

    if (client) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, start_time, status')
        .eq('client_id', client.id)
        .eq('business_id', business.id)
        .order('start_time', { ascending: false })
        .limit(5);

      lastBookings = bookings ?? [];
    }

    // 5. Build context
    const context = buildVapiContext({ business, client, lastBookings });

    // 6. Log to call_sessions
    const { error: sessionError } = await supabase
      .from('call_sessions')
      .insert({
        business_id:      business.id,
        client_id:        client?.id ?? null,
        caller_number:    fromNumber,
        context_snapshot: context,
        started_at:       new Date().toISOString()
      });

    if (sessionError) {
      console.error('Failed to create call_session:', sessionError.message);
    }

    // 7. Return TwiML connecting the call to Vapi using vapi_agent_id
    const vapiAgentId = phoneRecord.vapi_agent_id;
    return res.send(
      `<Response><Redirect method="POST">https://api.vapi.ai/twilio?assistantId=${vapiAgentId}</Redirect></Response>`
    );

  } catch (err) {
    console.error('handleInbound error:', err.message);
    return res.send('<Response><Hangup/></Response>');
  }
}

// Pure-ish payload processor — extracted so the webhook retry worker can
// replay raw payloads without going through HTTP. Returns an outcome summary;
// throws on any error so the caller can decide what to do (record + retry).
async function processVapiPayload(message) {
  if (!message || typeof message !== 'object') {
    const err = new Error('Missing or invalid message payload');
    err.code = 'MISSING_PAYLOAD';
    throw err;
  }

  if (message.type !== 'end-of-call-report') {
    return { received: true, type: message.type, processed: false };
  }

  const call         = message.call ?? {};
  const vapiCallId   = call.id;
  const callerPhone  = call.customer?.number ?? null;
  const endedReason  = call.endedReason ?? 'unknown';
  const durationSec  = call.duration ? Math.round(call.duration) : null;
  const recordingUrl = call.recordingUrl ?? null;
  const endedAt      = call.endedAt ?? new Date().toISOString();
  const startedAt    = call.startedAt ?? null;
  const transcript   = extractTranscript(message);

  // Find the open call_session for this caller
  let session = null;
  if (callerPhone) {
    const { data } = await supabase
      .from('call_sessions')
      .select('id, business_id, started_at')
      .eq('caller_number', callerPhone)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data;
  }

  if (!session) {
    return { received: true, matched_session: false };
  }

  // Load business for timezone, hours, average value
  const { data: business } = await supabase
    .from('businesses')
    .select('id, timezone, operating_hours, average_booking_value')
    .eq('id', session.business_id)
    .single();
  const timezone = business?.timezone || DEFAULT_TIMEZONE;

  // Determine if a real booking was created during the call window.
  // Only count CONFIRMED or COMPLETED — pending/expired don't count as
  // "booked" outcomes (audit C5 + attribution accuracy).
  const since = startedAt ?? session.started_at ?? new Date(Date.now() - 30 * 60 * 1000).toISOString();
  let booking = null;
  if (callerPhone) {
    const { data: clientRecord } = await supabase
      .from('clients')
      .select('id')
      .eq('business_id', session.business_id)
      .eq('phone', callerPhone)
      .maybeSingle();

    if (clientRecord) {
      const { data: bk } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('business_id', session.business_id)
        .eq('client_id', clientRecord.id)
        .in('status', ['confirmed', 'completed'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      booking = bk;
    }
  }

  // Resolve outcome
  const transcriptDetect = detectOutcomeFromTranscript(transcript);
  const outcome = resolveOutcome({
    bookingFound:      !!booking,
    transcriptOutcome: transcriptDetect.outcome,
    durationSec,
    endReason:         endedReason
  });

  // Derived flags
  const callStartIso = startedAt ?? session.started_at;
  const afterHours   = isAfterHours(callStartIso, business?.operating_hours, timezone);
  const concurrent   = await wasConcurrent(session.business_id, callStartIso, session.id);

  // Booking value (only meaningful when outcome === 'booked')
  let bookingValue = null;
  if (outcome === 'booked') {
    bookingValue = await estimateBookingValue({
      businessId: session.business_id,
      bookingId:  booking?.id,
      business
    });
  }

  // Decide whether we'll send the missed-call recovery SMS — and capture
  // whether it actually transmitted before flipping recovery_sms_sent.
  const shouldRecover = outcome !== 'booked' && !!callerPhone;
  let recoverySent = false;

  if (shouldRecover) {
    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('number')
      .eq('business_id', session.business_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const businessPhone = phoneRecord?.number ?? '';
    const msg = `สวัสดีครับ ขอโทษที่ไม่ได้รับสาย ต้องการจองนัดหมายไหมครับ? โทรกลับได้เลยครับ ${businessPhone}`.trim();

    try {
      await sendSms(callerPhone, msg);
      recoverySent = true;
    } catch (err) {
      console.error('Missed call SMS failed:', err.message);
      recoverySent = false;
    }
  }

  const { error: updateError } = await supabase
    .from('call_sessions')
    .update({
      vapi_call_id:      vapiCallId,
      end_reason:        endedReason,
      outcome,
      booking_value:     bookingValue,
      was_after_hours:   afterHours,
      was_concurrent:    concurrent,
      duration_sec:      durationSec,
      recording_url:     recordingUrl,
      ended_at:          endedAt,
      recovery_sms_sent: recoverySent
    })
    .eq('id', session.id);

  if (updateError) {
    // Throw — let caller record + retry. Failing to persist outcome is the
    // exact case C4 wants to recover from.
    throw new Error(`call_sessions update failed: ${updateError.message}`);
  }

  // Recompute monthly summary for the month containing this call
  recomputeMonthlySummary(session.business_id, new Date(callStartIso), timezone)
    .catch(err => console.error('recomputeMonthlySummary failed:', err.message));

  return { received: true, matched_session: true, outcome };
}

// POST /call/vapi-callback — thin HTTP wrapper. On any handler error we
// persist the raw payload to failed_webhooks and return 202. The retry
// worker (webhookRetryService) will replay until success or 3 dead retries.
async function handleVapiCallback(req, res) {
  const payload = req.body;
  try {
    const result = await processVapiPayload(payload?.message);
    return res.json(result);
  } catch (err) {
    console.error('Vapi webhook handler failed — recording for retry:', err.message);
    await webhookRetry.recordFailure({
      source:       'vapi',
      payload,
      errorMessage: err.message
    });
    // 202 Accepted: we've accepted responsibility but haven't fully processed.
    // Vapi sees success and won't retry on its end — our retry worker owns it now.
    return res.status(202).json({ received: true, queued_for_retry: true });
  }
}

// Register the payload processor with the retry worker so it can replay rows.
webhookRetry.registerHandler('vapi', (raw) => processVapiPayload(raw?.message));

module.exports = { handleInbound, handleVapiCallback, processVapiPayload };
