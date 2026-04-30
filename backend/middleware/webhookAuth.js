// ═══════════════════════════════════════════════════════════════════════════
// Webhook signature verification — Round 2 audit C1 + C2
// ═══════════════════════════════════════════════════════════════════════════
// Twilio:  validates X-Twilio-Signature against the request URL + sorted body.
//          Uses TWILIO_AUTH_TOKEN as the signing secret. URL is computed from
//          BASE_URL + req.originalUrl so Railway's load balancer can't break
//          it (do NOT trust req.protocol in front of a proxy).
//
// Vapi:    Vapi assistants can be configured with a server-side `secret` that
//          is sent verbatim in a custom header on every webhook. We require
//          X-Vapi-Secret to match VAPI_WEBHOOK_SECRET (shared-secret HMAC-equiv).
//          Vapi has no per-request HMAC of body, so this is the strongest
//          stable contract we have today.
//
// Both middlewares fail closed: if the env var is missing they return 503,
// not 200, so a misconfigured deploy can never silently disable verification.
// ═══════════════════════════════════════════════════════════════════════════

const twilio = require('twilio');

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function reject(res, code, status, message) {
  return res.status(status).json({ error: message, code });
}

// ── Twilio signature ──────────────────────────────────────────────────────
// Express must parse the body BEFORE this runs (so req.body is the form-decoded
// object Twilio signed). Order in routes:
//   router.post('/inbound', express.urlencoded(...), verifyTwilioSignature(), handler)
function verifyTwilioSignature() {
  return function (req, res, next) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const baseUrl   = process.env.BASE_URL;

    if (!authToken) {
      console.error('[webhookAuth] TWILIO_AUTH_TOKEN not set — webhooks cannot be verified');
      return reject(res, 'WEBHOOK_NOT_CONFIGURED', 503, 'Twilio webhook verification not configured');
    }
    if (!baseUrl) {
      console.error('[webhookAuth] BASE_URL not set — Twilio signature URL cannot be computed');
      return reject(res, 'WEBHOOK_NOT_CONFIGURED', 503, 'BASE_URL not configured');
    }

    const sig = req.headers['x-twilio-signature'];
    if (!sig) {
      return reject(res, 'WEBHOOK_INVALID', 401, 'Missing X-Twilio-Signature');
    }

    // Reconstruct the exact URL Twilio signed. originalUrl includes any query
    // string. Strip a trailing slash on baseUrl to avoid double-slash.
    const trimmed = baseUrl.replace(/\/+$/, '');
    const fullUrl = `${trimmed}${req.originalUrl}`;

    const ok = twilio.validateRequest(authToken, sig, fullUrl, req.body || {});
    if (!ok) {
      console.error('[webhookAuth] Twilio signature mismatch on', fullUrl);
      return reject(res, 'WEBHOOK_INVALID', 401, 'Twilio signature invalid');
    }
    return next();
  };
}

// ── Vapi shared-secret ────────────────────────────────────────────────────
function verifyVapiSecret() {
  return function (req, res, next) {
    const expected = process.env.VAPI_WEBHOOK_SECRET;
    if (!expected) {
      console.error('[webhookAuth] VAPI_WEBHOOK_SECRET not set — webhooks cannot be verified');
      return reject(res, 'WEBHOOK_NOT_CONFIGURED', 503, 'Vapi webhook secret not configured');
    }
    const provided = req.headers['x-vapi-secret'];
    if (!safeEq(provided || '', expected)) {
      return reject(res, 'WEBHOOK_INVALID', 401, 'Vapi webhook secret invalid');
    }
    return next();
  };
}

module.exports = {
  verifyTwilioSignature,
  verifyVapiSecret,
  // exported for tests
  _safeEq: safeEq
};
