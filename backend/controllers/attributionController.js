const supabase = require('../config/supabase');
const { OperisError, handleError } = require('../utils/errorHandler');
const { requireFields } = require('../utils/validation');
const {
  DEFAULT_TIMEZONE,
  BOOKING_OUTCOMES,
  isValidOutcome,
  monthStartString,
  monthRangeUtc,
  recomputeMonthlySummary,
  estimateBookingValue,
  isAfterHours,
  wasConcurrent
} = require('../services/attributionService');

const SUBSCRIPTION_COST_THB = 2990;

// ── Headline logic — never show zero/negative framing ──────────────────────

function buildHeadline({ revenue_captured_thb, calls_answered }) {
  const revenue = Number(revenue_captured_thb || 0);
  const answered = Number(calls_answered || 0);
  const roi = revenue / SUBSCRIPTION_COST_THB;

  const baht = Math.round(revenue).toLocaleString('en-US');

  if (roi >= 10) {
    return {
      text: `Operis captured ฿${baht} in bookings last month — ${Math.round(roi)}x your subscription cost.`,
      tier: 'roi_10x',
      roi_multiple: Number(roi.toFixed(1))
    };
  }
  if (roi >= 3) {
    return {
      text: `Operis captured ฿${baht} in bookings you would have missed.`,
      tier: 'roi_3x',
      roi_multiple: Number(roi.toFixed(1))
    };
  }
  if (roi >= 1) {
    return {
      text: `Operis is already paying for itself. ฿${baht} captured this month.`,
      tier: 'roi_1x',
      roi_multiple: Number(roi.toFixed(1))
    };
  }
  return {
    text: `Operis answered ${answered} calls this month. Bookings are building.`,
    tier: 'building',
    roi_multiple: Number(roi.toFixed(2))
  };
}

// Last 4 months series — current + 3 prior. Months with no data get 0s so the
// chart never shows a blank.
function buildLast4Months(summaries, timezone) {
  const series = [];
  const today = new Date();
  for (let i = 3; i >= 0; i--) {
    // First-of-month i months ago, in business timezone
    const ref = new Date(today);
    ref.setUTCMonth(ref.getUTCMonth() - i);
    const monthStr = monthStartString(ref, timezone);

    const found = summaries.find(s => s.month === monthStr);
    series.push(found || zeroSummary(monthStr));
  }
  return series;
}

function zeroSummary(monthStr) {
  return {
    month:                    monthStr,
    total_calls:              0,
    calls_answered:           0,
    calls_booked:             0,
    revenue_captured_thb:     0,
    after_hours_calls:        0,
    concurrent_calls_handled: 0,
    missed_call_recoveries:   0
  };
}

// ── GET /api/dashboard/:businessId/attribution ────────────────────────────

async function getAttribution(req, res) {
  try {
    // SECURITY: business_id sourced from verified session, not client input.
    if (req.params.businessId !== req.business_id) {
      throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
    }
    const businessId = req.business_id;

    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, timezone')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr) throw new OperisError(bizErr.message, 'DB_ERROR', 500);
    if (!business) throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);

    const timezone = business.timezone || DEFAULT_TIMEZONE;
    const today = new Date();
    const currentMonthStr = monthStartString(today, timezone);

    // Always recompute the current month from raw call_sessions so the
    // dashboard reflects events even if no POST /outcome has fired yet.
    await recomputeMonthlySummary(business.id, today, timezone);

    // Fetch the most recent 4 monthly summary rows
    const { data: summaries, error } = await supabase
      .from('monthly_summaries')
      .select('month, total_calls, calls_answered, calls_booked, revenue_captured_thb, after_hours_calls, concurrent_calls_handled, missed_call_recoveries')
      .eq('business_id', business.id)
      .order('month', { ascending: false })
      .limit(4);

    if (error) throw new OperisError(error.message, 'DB_ERROR', 500);

    const last4 = buildLast4Months(summaries ?? [], timezone);
    const current = last4[last4.length - 1];

    const headline = buildHeadline({
      revenue_captured_thb: current.revenue_captured_thb,
      calls_answered:       current.calls_answered
    });

    return res.json({
      business_id:       business.id,
      timezone,
      current_month:     current,
      last_4_months:     last4,
      subscription_cost: SUBSCRIPTION_COST_THB,
      headline_message:  headline.text,
      headline_tier:     headline.tier,
      roi_multiple:      headline.roi_multiple
    });

  } catch (err) {
    return handleError(res, err);
  }
}

// ── POST /api/calls/:callId/outcome ───────────────────────────────────────

async function postCallOutcome(req, res) {
  try {
    const { callId } = req.params;
    const { outcome, booking_value, end_reason, booking_id } = req.body || {};

    requireFields(req.body || {}, ['outcome']);

    if (!isValidOutcome(outcome)) {
      throw new OperisError(
        `outcome must be one of: ${BOOKING_OUTCOMES.join(', ')}`,
        'INVALID_OUTCOME',
        400
      );
    }

    // SECURITY: load the call_session scoped to the authenticated business.
    const { data: session, error: sessErr } = await supabase
      .from('call_sessions')
      .select('id, business_id, started_at')
      .eq('id', callId)
      .eq('business_id', req.business_id)
      .maybeSingle();

    if (sessErr) throw new OperisError(sessErr.message, 'DB_ERROR', 500);
    if (!session) throw new OperisError('Call session not found', 'CALL_NOT_FOUND', 404);

    const { data: business } = await supabase
      .from('businesses')
      .select('id, timezone, operating_hours, average_booking_value')
      .eq('id', session.business_id)
      .single();

    const timezone = business?.timezone || DEFAULT_TIMEZONE;

    // Compute derived flags and booking value
    const afterHours = isAfterHours(session.started_at, business?.operating_hours, timezone);
    const concurrent = await wasConcurrent(session.business_id, session.started_at, session.id);

    let resolvedBookingValue = null;
    if (outcome === 'booked') {
      resolvedBookingValue = await estimateBookingValue({
        explicit:   typeof booking_value === 'number' ? booking_value : undefined,
        businessId: session.business_id,
        bookingId:  booking_id,
        business
      });
    }

    const update = {
      outcome,
      booking_value:    resolvedBookingValue,
      was_after_hours:  afterHours,
      was_concurrent:   concurrent
    };
    if (typeof end_reason === 'string' && end_reason.length > 0) {
      update.end_reason = end_reason;
    }

    const { error: updateErr } = await supabase
      .from('call_sessions')
      .update(update)
      .eq('id', session.id);

    if (updateErr) throw new OperisError(updateErr.message, 'DB_ERROR', 500);

    // Recalc the month containing this call
    await recomputeMonthlySummary(
      session.business_id,
      new Date(session.started_at),
      timezone
    );

    return res.json({ success: true, call_id: session.id, outcome, booking_value: resolvedBookingValue });

  } catch (err) {
    return handleError(res, err);
  }
}

// ── GET /api/dashboard/:businessId/attribution/export ─────────────────────

const CSV_HEADERS = [
  'call_id',
  'started_at',
  'ended_at',
  'caller_number',
  'duration_sec',
  'outcome',
  'booking_value_thb',
  'was_after_hours',
  'was_concurrent',
  'recovery_sms_sent',
  'end_reason'
];

// CSV escape with formula-injection mitigation (round 3 C4).
//
// Every caller_number is E.164 — i.e. it always starts with '+'. Without the
// leading-quote guard below, opening the export in Excel / Google Sheets /
// Numbers evaluates every phone cell as a formula. An attacker who can
// influence any other field (end_reason via a forged Vapi callback, transcript
// fragments stored in call_sessions, etc.) can ship `=cmd|...` style payloads
// directly into the founder's spreadsheet.
//
// Defence: prefix any cell beginning with =, +, -, @, tab, or CR with a single
// quote, which forces spreadsheets to treat the cell as text. Then apply the
// usual quote-and-escape for cells containing commas, quotes, or newlines.
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function exportAttributionCsv(req, res) {
  try {
    // SECURITY: business_id sourced from verified session, not client input.
    if (req.params.businessId !== req.business_id) {
      throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
    }
    const businessId = req.business_id;

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .maybeSingle();

    if (!business) throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);

    const { data: rows, error } = await supabase
      .from('call_sessions')
      .select('id, started_at, ended_at, caller_number, duration_sec, outcome, booking_value, was_after_hours, was_concurrent, recovery_sms_sent, end_reason')
      .eq('business_id', business.id)
      .order('started_at', { ascending: false })
      .limit(10000);

    if (error) throw new OperisError(error.message, 'DB_ERROR', 500);

    const lines = [CSV_HEADERS.join(',')];
    for (const r of rows ?? []) {
      lines.push([
        r.id,
        r.started_at,
        r.ended_at,
        r.caller_number,
        r.duration_sec,
        r.outcome,
        r.booking_value,
        r.was_after_hours,
        r.was_concurrent,
        r.recovery_sms_sent,
        r.end_reason
      ].map(csvEscape).join(','));
    }

    // Filename per spec: operis_<business-name>_<YYYY-MM>_bookings.csv
    const safeName = (business.name || 'operis').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const yyyymm   = new Date().toISOString().slice(0, 7);
    const filename = `operis_${safeName}_${yyyymm}_bookings.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(lines.join('\n'));

  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  getAttribution,
  postCallOutcome,
  exportAttributionCsv,
  buildHeadline,
  SUBSCRIPTION_COST_THB
};
