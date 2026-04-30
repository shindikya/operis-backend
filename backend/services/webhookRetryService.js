// ═══════════════════════════════════════════════════════════════════════════
// Webhook retry worker — audit C4
// ═══════════════════════════════════════════════════════════════════════════
// Runs every 5 minutes. Pulls rows from failed_webhooks where status='failed'
// and retry_count < MAX_RETRIES, re-processes through the original handler,
// and updates status accordingly. After MAX_RETRIES, flips status='dead'.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = require('../config/supabase');

const MAX_RETRIES = 3;
const TICK_MS = 5 * 60 * 1000;

let processVapiWebhookPayload = null;

// Indirection so callController can register its handler without us creating
// a circular require at module load time.
function registerHandler(source, fn) {
  if (source === 'vapi') processVapiWebhookPayload = fn;
}

async function recordFailure({ source, payload, errorMessage }) {
  const { error } = await supabase
    .from('failed_webhooks')
    .insert({
      source,
      raw_payload:   payload,
      error_message: errorMessage,
      status:        'failed',
      retry_count:   0
    });
  if (error) {
    console.error('[webhookRetry] Failed to record failure:', error.message);
  }
}

async function processOne(row) {
  let handler;
  if (row.source === 'vapi') handler = processVapiWebhookPayload;

  if (!handler) {
    console.error(`[webhookRetry] No handler registered for source=${row.source}; skipping ${row.id}`);
    return;
  }

  try {
    await handler(row.raw_payload);

    await supabase
      .from('failed_webhooks')
      .update({
        status:         'resolved',
        resolved_at:    new Date().toISOString(),
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', row.id);

    console.log(`[webhookRetry] Resolved ${row.source} webhook ${row.id} after ${row.retry_count + 1} attempt(s)`);
  } catch (err) {
    const nextCount = row.retry_count + 1;
    const isDead    = nextCount >= MAX_RETRIES;

    await supabase
      .from('failed_webhooks')
      .update({
        retry_count:     nextCount,
        last_attempt_at: new Date().toISOString(),
        error_message:   err.message,
        status:          isDead ? 'dead' : 'failed'
      })
      .eq('id', row.id);

    if (isDead) {
      console.error(`[webhookRetry] DEAD after ${nextCount} retries — ${row.source} webhook ${row.id}: ${err.message}`);
    } else {
      console.warn(`[webhookRetry] Retry ${nextCount}/${MAX_RETRIES} failed for ${row.id}: ${err.message}`);
    }
  }
}

async function tick() {
  try {
    const { data: rows, error } = await supabase
      .from('failed_webhooks')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES)
      .order('received_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[webhookRetry] Query failed:', error.message);
      return;
    }
    if (!rows || rows.length === 0) return;

    console.log(`[webhookRetry] Processing ${rows.length} pending failure(s)`);
    for (const row of rows) {
      await processOne(row);
    }
  } catch (err) {
    // Never let a tick failure escape — would crash the Node process under
    // the default unhandledRejection policy.
    console.error('[webhookRetry] Tick crashed:', err.message);
  }
}

function startWebhookRetryCron() {
  // Initial run on boot, then every TICK_MS.
  tick().catch(err => console.error('[webhookRetry] Initial tick failed:', err.message));
  setInterval(() => {
    tick().catch(err => console.error('[webhookRetry] Tick failed:', err.message));
  }, TICK_MS);
  console.log('[webhookRetry] Cron started — runs every 5 minutes');
}

module.exports = {
  registerHandler,
  recordFailure,
  startWebhookRetryCron,
  // exported for tests / manual runs
  _tick: tick,
  MAX_RETRIES
};
