const supabase = require('../config/supabase');
const { buildVapiContext } = require('../utils/vapiContext');
const { handleError } = require('../utils/errorHandler');
const { sendSms } = require('../services/smsService');

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

// POST /call/vapi-callback — Vapi sends outcome when call ends
async function handleVapiCallback(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message', code: 'MISSING_PAYLOAD' });
    }

    if (message.type === 'end-of-call-report') {
      const call         = message.call ?? {};
      const vapiCallId   = call.id;
      const callerPhone  = call.customer?.number ?? null;
      const endedReason  = call.endedReason ?? 'unknown';
      const durationSec  = call.duration ? Math.round(call.duration) : null;
      const recordingUrl = call.recordingUrl ?? null;
      const endedAt      = call.endedAt ?? new Date().toISOString();
      const startedAt    = call.startedAt ?? null;

      // Find the open call_session for this caller (vapi_call_id not set at insert time)
      let sessionBusinessId = null;

      if (callerPhone) {
        const { data: session } = await supabase
          .from('call_sessions')
          .select('id, business_id')
          .eq('caller_number', callerPhone)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          sessionBusinessId = session.business_id;
          const { error: updateError } = await supabase
            .from('call_sessions')
            .update({
              vapi_call_id:  vapiCallId,
              outcome:       endedReason,
              duration_sec:  durationSec,
              recording_url: recordingUrl,
              ended_at:      endedAt
            })
            .eq('id', session.id);

          if (updateError) {
            console.error('Failed to update call_session:', updateError.message);
          }
        }
      }

      // Missed call recovery — send SMS if no booking was created during this call
      if (callerPhone && sessionBusinessId) {
        const since = startedAt ?? new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: clientRecord } = await supabase
          .from('clients')
          .select('id')
          .eq('business_id', sessionBusinessId)
          .eq('phone', callerPhone)
          .maybeSingle();

        let bookingCreated = false;
        if (clientRecord) {
          const { data: booking } = await supabase
            .from('bookings')
            .select('id')
            .eq('business_id', sessionBusinessId)
            .eq('client_id', clientRecord.id)
            .gte('created_at', since)
            .limit(1)
            .maybeSingle();
          bookingCreated = !!booking;
        }

        if (!bookingCreated) {
          const { data: phoneRecord } = await supabase
            .from('phone_numbers')
            .select('number')
            .eq('business_id', sessionBusinessId)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

          const businessPhone = phoneRecord?.number ?? '';
          const msg = `สวัสดีครับ ขอโทษที่ไม่ได้รับสาย ต้องการจองนัดหมายไหมครับ? โทรกลับได้เลยครับ ${businessPhone}`.trim();

          sendSms(callerPhone, msg)
            .catch(err => console.error('Missed call SMS failed:', err.message));
        }
      }
    }

    return res.json({ received: true });

  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { handleInbound, handleVapiCallback };
