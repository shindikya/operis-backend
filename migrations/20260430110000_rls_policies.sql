-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security policies — every business-data table
-- 2026-04-30
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Defence-in-depth at the database layer. The backend uses the service-role
-- key (which BYPASSES RLS) plus the auth middleware in backend/middleware/auth.js
-- to enforce ownership server-side. RLS is the second wall: any direct anon-key
-- query from the browser (dashboard.html) is hard-scoped to the caller's own
-- business by the database itself.
--
-- Standard pattern: any table with a `business_id` column allows access only
-- when that business_id belongs to the authenticated user via:
--     business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid())
--
-- The `businesses` table itself uses owner_user_id = auth.uid() directly.
-- The migration is idempotent: DROP POLICY IF EXISTS before each CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── businesses ─────────────────────────────────────────────────────────────
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_owner_select" ON businesses;
DROP POLICY IF EXISTS "biz_owner_update" ON businesses;
DROP POLICY IF EXISTS "biz_owner_insert" ON businesses;
DROP POLICY IF EXISTS "biz_owner_delete" ON businesses;

CREATE POLICY "biz_owner_select" ON businesses
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "biz_owner_update" ON businesses
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- INSERT / DELETE on businesses go through the backend (service-role) only.
-- No anon/authenticated INSERT or DELETE policy → blocked by default once RLS
-- is enabled.

-- ── Helper: re-usable scope check ─────────────────────────────────────────
-- Postgres can't reuse a CTE across policies, so we inline the subquery in
-- each policy below. Use IN (subquery) — safer than EXISTS for nullable cols.

-- ── bookings ──────────────────────────────────────────────────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON bookings;
CREATE POLICY "biz_isolation" ON bookings
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── clients ───────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON clients;
CREATE POLICY "biz_isolation" ON clients
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── staff ─────────────────────────────────────────────────────────────────
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON staff;
CREATE POLICY "biz_isolation" ON staff
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── services ──────────────────────────────────────────────────────────────
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON services;
CREATE POLICY "biz_isolation" ON services
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── availability_windows ──────────────────────────────────────────────────
ALTER TABLE availability_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON availability_windows;
CREATE POLICY "biz_isolation" ON availability_windows
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── reminders ─────────────────────────────────────────────────────────────
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON reminders;
CREATE POLICY "biz_isolation" ON reminders
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── call_sessions ─────────────────────────────────────────────────────────
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON call_sessions;
CREATE POLICY "biz_isolation" ON call_sessions
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── monthly_summaries (revenue attribution) ───────────────────────────────
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON monthly_summaries;
CREATE POLICY "biz_isolation" ON monthly_summaries
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── communication_logs ────────────────────────────────────────────────────
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON communication_logs;
CREATE POLICY "biz_isolation" ON communication_logs
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── client_insights ───────────────────────────────────────────────────────
ALTER TABLE client_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON client_insights;
CREATE POLICY "biz_isolation" ON client_insights
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── deposits ──────────────────────────────────────────────────────────────
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON deposits;
CREATE POLICY "biz_isolation" ON deposits
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── onboarding_state ──────────────────────────────────────────────────────
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON onboarding_state;
CREATE POLICY "biz_isolation" ON onboarding_state
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── waitlist_entries ──────────────────────────────────────────────────────
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON waitlist_entries;
CREATE POLICY "biz_isolation" ON waitlist_entries
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

-- ── phone_numbers ─────────────────────────────────────────────────────────
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "biz_isolation" ON phone_numbers;
CREATE POLICY "biz_isolation" ON phone_numbers
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_user_id = auth.uid()));

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification queries (run manually after applying):
--
-- 1. Confirm RLS is enabled on every table:
--      SELECT tablename, rowsecurity FROM pg_tables
--      WHERE schemaname = 'public' AND rowsecurity = false;
--    Expected: only `monthly_summaries` etc. listed if any was missed.
--
-- 2. Cross-tenant test (run in Supabase SQL editor as authenticated user A):
--      SELECT count(*) FROM bookings WHERE business_id = '<business-B-uuid>';
--    Expected: 0 rows. If you see B's data, RLS is not enforced.
-- ═══════════════════════════════════════════════════════════════════════════
