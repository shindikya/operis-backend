const supabase = require('../config/supabase');

const DEFAULT_TIMEZONE = 'Asia/Bangkok';
const DEFAULT_BOOKING_VALUE_THB = 500;

const BOOKING_PHRASES = [
  'ยืนยัน',
  'จองแล้ว',
  'นัดหมายเรียบร้อย',
  'confirmed',
  'booked for',
  'appointment confirmed',
  'see you on'
];

const BOOKING_OUTCOMES = ['booked', 'enquiry', 'missed_by_ai', 'abandoned'];

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ── Time helpers (timezone-aware month + after-hours calculations) ─────────

// Returns { y, m, d, hh, mm, dayOfWeek (0=Sun) } for a given UTC date in the
// target IANA timezone, computed via Intl.DateTimeFormat. No external libs.
function partsInTimezone(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone:    timezone,
    year:        'numeric',
    month:       '2-digit',
    day:         '2-digit',
    hour:        '2-digit',
    minute:      '2-digit',
    weekday:     'short',
    hour12:      false
  });

  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    y:         Number(parts.year),
    m:         Number(parts.month),
    d:         Number(parts.day),
    hh:        Number(parts.hour),
    mm:        Number(parts.minute),
    dayOfWeek: weekdayMap[parts.weekday] ?? 0
  };
}

// First day of the month containing `date`, in the given timezone, as YYYY-MM-DD.
function monthStartString(date, timezone) {
  const { y, m } = partsInTimezone(date, timezone);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

// Returns { startUtc, endUtc } as ISO strings — half-open [start, end) — for
// the calendar month containing `date` in the business timezone.
// Implementation: pick a reference UTC instant in the middle of the local
// month, then walk both directions to find UTC boundaries that map to
// midnight local time on day 1 of this and next month.
function monthRangeUtc(date, timezone) {
  const { y, m } = partsInTimezone(date, timezone);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1     : m + 1;

  return {
    startUtc: localMidnightToUtc(y,     m,     1, timezone),
    endUtc:   localMidnightToUtc(nextY, nextM, 1, timezone)
  };
}

// Convert "midnight on (y, m, d) in timezone" to a UTC ISO string.
// Iterative because IANA offsets aren't fixed — converges in 2 passes for any
// real-world zone, including DST boundaries.
function localMidnightToUtc(y, m, d, timezone) {
  const targetMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  let guess = new Date(targetMs);
  for (let i = 0; i < 3; i++) {
    const p = partsInTimezone(guess, timezone);
    const formattedAsUtcMs = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    const diffMs = formattedAsUtcMs - targetMs;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() - diffMs);
  }
  return guess.toISOString();
}

// ── Outcome detection ─────────────────────────────────────────────────────

// Inspect a Vapi end-of-call payload and decide the booking outcome.
// Returns { outcome, transcriptMatched } — caller decides whether to override
// based on whether a real booking row was created during the call window.
function detectOutcomeFromTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return { outcome: null, transcriptMatched: false };
  }
  const lower = transcript.toLowerCase();
  const hit = BOOKING_PHRASES.some(p => lower.includes(p.toLowerCase()));
  return { outcome: hit ? 'booked' : null, transcriptMatched: hit };
}

// Decide outcome given all signals. Booking row presence wins over transcript.
function resolveOutcome({ bookingFound, transcriptOutcome, durationSec, endReason }) {
  if (bookingFound) return 'booked';
  if (transcriptOutcome === 'booked') return 'booked';

  // No booking — distinguish enquiry / missed / abandoned
  const isVeryShort = typeof durationSec === 'number' && durationSec < 5;
  const failedToConnect = ['no-answer', 'silence-timeout', 'pipeline-error', 'assistant-error']
    .includes(endReason);

  if (failedToConnect) return 'missed_by_ai';
  if (isVeryShort)     return 'abandoned';
  return 'enquiry';
}

// Validate a manually-supplied outcome
function isValidOutcome(value) {
  return BOOKING_OUTCOMES.includes(value);
}

// ── After-hours / concurrent helpers ───────────────────────────────────────

// operatingHours shape: { mon: {open:"09:00",close:"20:00"}, ... }
// Missing day = closed all day. Returns true if the call is outside hours.
function isAfterHours(callStartedAtUtc, operatingHours, timezone) {
  if (!operatingHours || typeof operatingHours !== 'object') {
    // No hours configured — treat all calls as in-hours (don't inflate)
    return false;
  }
  const tz = timezone || DEFAULT_TIMEZONE;
  const p = partsInTimezone(new Date(callStartedAtUtc), tz);
  const dayKey = DAY_KEYS[p.dayOfWeek];
  const window = operatingHours[dayKey];

  if (!window || !window.open || !window.close) return true;

  const callMinutes = p.hh * 60 + p.mm;
  const [oH, oM] = String(window.open).split(':').map(Number);
  const [cH, cM] = String(window.close).split(':').map(Number);
  const openMin  = oH * 60 + oM;
  const closeMin = cH * 60 + cM;

  return callMinutes < openMin || callMinutes >= closeMin;
}

// Check if another call_session for the same business overlapped this one's start.
async function wasConcurrent(businessId, callStartedAtUtc, callSessionId) {
  const startedAt = new Date(callStartedAtUtc).toISOString();

  const { data, error } = await supabase
    .from('call_sessions')
    .select('id')
    .eq('business_id', businessId)
    .neq('id', callSessionId)
    .lte('started_at', startedAt)
    .or(`ended_at.is.null,ended_at.gt.${startedAt}`)
    .limit(1);

  if (error) {
    console.error('wasConcurrent check failed:', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

// ── Booking value estimation ──────────────────────────────────────────────

// Returns THB value to attribute to a 'booked' outcome.
// Priority: explicit override > matched booking's service price > business avg.
async function estimateBookingValue({ explicit, businessId, bookingId, business }) {
  if (typeof explicit === 'number' && !Number.isNaN(explicit)) return explicit;

  if (bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('service:services(price_cents, currency)')
      .eq('id', bookingId)
      .maybeSingle();
    const svc = booking?.service;
    if (svc && typeof svc.price_cents === 'number' && svc.price_cents > 0) {
      // Treat THB-priced services as already-baht, others ignored to avoid
      // bad FX. Stripe currency is lowercase ISO.
      if (!svc.currency || svc.currency.toLowerCase() === 'thb') {
        return Number((svc.price_cents / 100).toFixed(2));
      }
    }
  }

  const avg = business?.average_booking_value
    ?? (await loadBusinessAverage(businessId));
  return Number(avg ?? DEFAULT_BOOKING_VALUE_THB);
}

async function loadBusinessAverage(businessId) {
  const { data } = await supabase
    .from('businesses')
    .select('average_booking_value')
    .eq('id', businessId)
    .maybeSingle();
  return data?.average_booking_value ?? DEFAULT_BOOKING_VALUE_THB;
}

// ── Monthly summary recompute ─────────────────────────────────────────────

// Recomputes the monthly_summaries row for a given business + month
// containing `date`. Idempotent — always reads current call_sessions state.
async function recomputeMonthlySummary(businessId, date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const monthStr = monthStartString(date, timezone);
  const { startUtc, endUtc } = monthRangeUtc(date, timezone);

  const { data: rows, error } = await supabase
    .from('call_sessions')
    .select('outcome, booking_value, was_after_hours, was_concurrent, recovery_sms_sent')
    .eq('business_id', businessId)
    .gte('started_at', startUtc)
    .lt('started_at', endUtc);

  if (error) {
    console.error('recomputeMonthlySummary read failed:', error.message);
    return null;
  }

  const sessions = rows ?? [];
  const summary = {
    business_id:              businessId,
    month:                    monthStr,
    total_calls:              sessions.length,
    calls_answered:           sessions.filter(s => s.outcome && s.outcome !== 'missed_by_ai').length,
    calls_booked:             sessions.filter(s => s.outcome === 'booked').length,
    revenue_captured_thb:     sessions
      .filter(s => s.outcome === 'booked')
      .reduce((sum, s) => sum + Number(s.booking_value ?? 0), 0),
    after_hours_calls:        sessions.filter(s => s.was_after_hours).length,
    concurrent_calls_handled: sessions.filter(s => s.was_concurrent && s.outcome && s.outcome !== 'missed_by_ai').length,
    missed_call_recoveries:   sessions.filter(s => s.recovery_sms_sent).length,
    updated_at:               new Date().toISOString()
  };

  const { error: upsertError } = await supabase
    .from('monthly_summaries')
    .upsert(summary, { onConflict: 'business_id,month' });

  if (upsertError) {
    console.error('recomputeMonthlySummary upsert failed:', upsertError.message);
    return null;
  }

  return summary;
}

module.exports = {
  DEFAULT_TIMEZONE,
  DEFAULT_BOOKING_VALUE_THB,
  BOOKING_OUTCOMES,
  partsInTimezone,
  monthStartString,
  monthRangeUtc,
  detectOutcomeFromTranscript,
  resolveOutcome,
  isValidOutcome,
  isAfterHours,
  wasConcurrent,
  estimateBookingValue,
  recomputeMonthlySummary
};
