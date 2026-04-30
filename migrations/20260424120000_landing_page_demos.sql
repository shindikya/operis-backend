-- ═══════════════════════════════════════════════════════════════════════════
-- Landing-page demo capture
-- 2026-04-24
-- ═══════════════════════════════════════════════════════════════════════════
-- Lightweight lead-capture for the "Build your receptionist" widget on the
-- public landing page. We log business name + language preference + UA/IP so
-- the growth team can reach out to interested visitors without ever asking
-- them for an email upfront.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS landing_page_demos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT        NOT NULL,
  language      TEXT        NOT NULL CHECK (language IN ('th', 'en', 'both')),
  ip            INET,
  user_agent    TEXT,
  referrer      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS landing_page_demos_created_idx
  ON landing_page_demos (created_at DESC);

COMMIT;
