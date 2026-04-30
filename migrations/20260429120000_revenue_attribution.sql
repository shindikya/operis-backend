-- ═══════════════════════════════════════════════════════════════════════════
-- Revenue Attribution Dashboard — schema additions
-- 2026-04-29
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds columns for booking-outcome tracking on call_sessions, business-level
-- operating hours + average booking value, and a new monthly_summaries table.
-- All ADD COLUMN statements use IF NOT EXISTS so this migration is idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── businesses ─────────────────────────────────────────────────────────────
-- operating_hours: per-day open/close in business timezone
--   { "mon": {"open":"09:00","close":"20:00"}, ... }  (keys: mon|tue|wed|thu|fri|sat|sun)
--   A missing key means closed that day.
-- average_booking_value: THB, used to estimate booking_value when actual price unknown
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS operating_hours      JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS average_booking_value NUMERIC(10,2) DEFAULT 500;

-- ── call_sessions ─────────────────────────────────────────────────────────
-- The existing `outcome` column was being overwritten with Vapi's endedReason.
-- We preserve that as `end_reason` and reclaim `outcome` for booking semantics
-- per the data-model docs: 'booked' | 'enquiry' | 'missed_by_ai' | 'abandoned'.
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS end_reason         TEXT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS booking_value      NUMERIC(10,2);
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS was_after_hours    BOOLEAN DEFAULT FALSE;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS was_concurrent     BOOLEAN DEFAULT FALSE;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS recovery_sms_sent  BOOLEAN DEFAULT FALSE;

-- One-time backfill: if existing rows have an outcome that looks like a Vapi
-- endedReason (anything other than the four valid booking outcomes), move it
-- to end_reason and clear outcome.
UPDATE call_sessions
SET end_reason = outcome,
    outcome    = NULL
WHERE outcome IS NOT NULL
  AND outcome NOT IN ('booked', 'enquiry', 'missed_by_ai', 'abandoned');

CREATE INDEX IF NOT EXISTS call_sessions_business_started_idx
  ON call_sessions (business_id, started_at DESC);

-- ── monthly_summaries ─────────────────────────────────────────────────────
-- Denormalised per-business per-month rollup. Recomputed on each call outcome.
-- One row per (business_id, month). `month` is the first day of the month
-- in the business's local timezone, stored as a DATE.
CREATE TABLE IF NOT EXISTS monthly_summaries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month                    DATE NOT NULL,
  total_calls              INTEGER NOT NULL DEFAULT 0,
  calls_answered           INTEGER NOT NULL DEFAULT 0,
  calls_booked             INTEGER NOT NULL DEFAULT 0,
  revenue_captured_thb     NUMERIC(12,2) NOT NULL DEFAULT 0,
  after_hours_calls        INTEGER NOT NULL DEFAULT 0,
  concurrent_calls_handled INTEGER NOT NULL DEFAULT 0,
  missed_call_recoveries   INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, month)
);

CREATE INDEX IF NOT EXISTS monthly_summaries_business_month_idx
  ON monthly_summaries (business_id, month DESC);

COMMIT;
