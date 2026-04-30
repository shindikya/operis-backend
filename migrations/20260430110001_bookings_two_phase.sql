-- ═══════════════════════════════════════════════════════════════════════════
-- Two-phase booking + race-safe slot uniqueness
-- 2026-04-30  (audit C3 + C5)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- C5 — ghost bookings on mid-call hangup:
--   New flow inserts AI-tool-created bookings as 'pending' with a 10-minute
--   expires_at. The AI calls PATCH /booking/:id/confirm only after explicit
--   caller confirmation. A cron sweeps expired pendings every 5 minutes.
--
-- C3 — concurrent booking race:
--   The exclusion constraint referenced in CONTEXT.md is augmented (or
--   created if missing) with an explicit unique partial index on
--   (business_id, staff_id, start_time) WHERE status IN ('confirmed','pending').
--   This makes both racing inserts atomic at the DB layer — second one fails
--   with 23505, caught by the controller's BOOKING_CONFLICT branch.
--   "Pending" rows participate in uniqueness so a half-completed AI booking
--   blocks parallel attempts at the same slot until it expires.
--
-- Idempotent — uses IF NOT EXISTS / DROP IF EXISTS where supported.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── bookings.expires_at ───────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Status check: allow 'pending' alongside the existing values.
-- CONTEXT.md documents: confirmed, cancelled, completed, no_show.
-- We add 'pending' and 'expired' for the two-phase flow.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'expired'));

-- Helpful index for the expiry cron
CREATE INDEX IF NOT EXISTS bookings_pending_expiry_idx
  ON bookings (expires_at)
  WHERE status = 'pending';

-- ── Race-safe slot uniqueness ─────────────────────────────────────────────
-- Unique partial index — only enforces against active bookings (confirmed +
-- pending). Cancelled / completed / expired don't count.
-- staff_id may be NULL (some businesses don't track staff per booking); for
-- those, uniqueness is per-business + start_time. COALESCE forces a stable
-- key for NULL staff.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_uniq_active
  ON bookings (business_id, COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::uuid), start_time)
  WHERE status IN ('confirmed', 'pending');

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Race test (run manually in two psql sessions):
--   Session A:  BEGIN; INSERT INTO bookings (...) VALUES (...slot X...);
--   Session B:  BEGIN; INSERT INTO bookings (...) VALUES (...slot X...);
--   Session A:  COMMIT;  -- succeeds
--   Session B:  COMMIT;  -- fails with 23505 (unique_violation)
-- ═══════════════════════════════════════════════════════════════════════════
