-- ═══════════════════════════════════════════════════════════════════════════
-- failed_webhooks — durable record of webhook deliveries that failed handling
-- 2026-04-30  (audit C4)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- When a Vapi (or other) webhook fires and the handler throws, the raw
-- payload is captured here so a retry worker can re-process it. Without
-- this table, a single DB blip during call-end means the booking outcome
-- and revenue attribution for that call are lost forever.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS failed_webhooks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source         TEXT NOT NULL,                         -- 'vapi' | 'twilio' | etc.
  raw_payload    JSONB NOT NULL,
  error_message  TEXT,
  status         TEXT NOT NULL DEFAULT 'failed'
                 CHECK (status IN ('failed', 'resolved', 'dead')),
  retry_count    INTEGER NOT NULL DEFAULT 0,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS failed_webhooks_retry_idx
  ON failed_webhooks (status, retry_count, received_at)
  WHERE status = 'failed';

-- failed_webhooks is a backend-internal table — no RLS, no public access.
-- Service-role only. We still enable RLS to prevent any anon key from reading
-- it (RLS-on with no policy = deny-all to non-service callers).
ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;

COMMIT;
