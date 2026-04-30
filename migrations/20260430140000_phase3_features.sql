-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 3 — feature batch (cancellation policy, deposits, intake questions)
-- 2026-04-30
-- ═══════════════════════════════════════════════════════════════════════════
-- All ALTERs use IF NOT EXISTS so this migration is idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── businesses ────────────────────────────────────────────────────────────
-- cancellation_window_hours: hours before start_time during which a caller
-- cannot cancel via the AI. The AI flags it for owner review instead.
-- promptpay_id: Thai PromptPay identifier (phone or national ID) used to
-- generate QR codes for high-risk booking deposits.
-- deposit_threshold_thb: minimum booking value (THB) above which the AI
-- triggers the deposit-pending flow for first-time callers.
-- intake_questions: JSONB array of up to 3 owner-configured questions the
-- AI asks after confirming a booking slot.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cancellation_window_hours INTEGER DEFAULT 24;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cancellation_policy_text  TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS promptpay_id              TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS deposit_threshold_thb     INTEGER DEFAULT 1500;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS intake_questions          JSONB DEFAULT '[]'::jsonb;

-- ── bookings ──────────────────────────────────────────────────────────────
-- intake_answers: JSONB array of { question, answer } recorded against
-- the booking when the AI asks the configured intake_questions.
-- deposit_paid_at: NULL until the owner manually marks a deposit_pending
-- booking as paid via the dashboard.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS intake_answers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flagged_for_owner BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Loosen the status check to allow 'deposit_pending'. Drop and re-add so
-- this works regardless of original constraint name.
-- IMPORTANT: this superset MUST include every status added by earlier
-- migrations — in particular `pending` and `expired` from
-- 20260430110001_bookings_two_phase.sql. Dropping them silently disables
-- the two-phase booking flow (audit C5) and causes every Vapi-tool-path
-- INSERT to fail with check_violation. Round-3 audit C1 — do not remove
-- these values from the list without updating bookingController.js +
-- bookingExpiryService.js in the same change.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_status_check'
  ) THEN
    EXECUTE 'ALTER TABLE bookings DROP CONSTRAINT bookings_status_check';
  END IF;
END $$;

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'expired', 'deposit_pending'));

-- ── clients ───────────────────────────────────────────────────────────────
-- Existing `notes` column is reused for owner-authored notes per client.
-- This index supports fast lookup by phone for the AI's call-start context load.
CREATE INDEX IF NOT EXISTS clients_business_phone_idx
  ON clients (business_id, phone);

COMMIT;
