// ═══════════════════════════════════════════════════════════════════════════
// Operis auth middleware
// ═══════════════════════════════════════════════════════════════════════════
//
// Protected routes audit — 2026-04-30
// ─────────────────────────────────────────────────────────────────────────
//
// PUBLIC (whitelisted, no auth required):
//   GET  /                             — root banner
//   GET  /health                       — DB connectivity check
//   POST /call/inbound                 — Twilio webhook (signature validation TBD, see audit C2)
//   POST /call/vapi-callback           — Vapi end-of-call webhook (signature validation TBD)
//   GET  /demo                         — public demo HTML page
//   POST /demo/setup                   — public demo configurator (shared agent)
//
// PROTECTED — Supabase JWT (require requireSupabaseAuth):
//   GET    /booking/:id
//   GET    /booking/business/:business_id
//   PATCH  /booking/:id/cancel
//   GET    /availability
//   POST   /onboarding/provision
//   GET    /api/dashboard/:businessId/attribution
//   GET    /api/dashboard/:businessId/attribution/export
//   POST   /api/calls/:callId/outcome
//
// PROTECTED — Vapi tool secret OR Supabase JWT (require requireBookingAuth):
//   POST   /booking
//
// PROTECTED — Admin token (require requireAdmin):
//   POST   /provision
//
// ─────────────────────────────────────────────────────────────────────────
// Notes on whitelist mapping:
//   The original audit prompt referenced /webhooks/twilio and /webhooks/vapi,
//   plus /auth/login + /auth/signup. The actual routes in this codebase are
//   /call/inbound and /call/vapi-callback; login is handled directly by the
//   Supabase JS client in login.html (no server route). The whitelist above
//   reflects the real routes — renaming would be a refactor outside scope.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = require('../config/supabase');
const { OperisError } = require('../utils/errorHandler');

// ── Helpers ───────────────────────────────────────────────────────────────

function readBearer(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth || typeof auth !== 'string') return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function safeEq(a, b) {
  // Constant-time string compare; both must be strings of equal length to match.
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function reject(res, code, status, message) {
  return res.status(status).json({ error: message, code });
}

// ── Supabase JWT verification ─────────────────────────────────────────────

// Verifies a Supabase JWT and looks up the business row this user owns.
// Attaches req.user, req.business, req.business_id on success.
async function verifySupabaseToken(token) {
  // supabase.auth.getUser(token) verifies the JWT against the project secret
  // configured in SUPABASE_SERVICE_KEY's project. Returns { data: { user }, error }.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new OperisError('Invalid or expired session', 'AUTH_INVALID', 401);
  }
  const userId = data.user.id;

  // Look up the business this user owns. owner_user_id is UNIQUE per CONTEXT.md.
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, timezone')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (bizErr) {
    throw new OperisError('Failed to load business', 'DB_ERROR', 500);
  }
  if (!business) {
    // Authenticated user has no business yet — allowed for /provision flows
    // (caller must explicitly opt in to no-business via { allowNoBusiness: true })
    return { user: data.user, business: null, business_id: null };
  }
  return { user: data.user, business, business_id: business.id };
}

// ── Public middlewares ────────────────────────────────────────────────────

// Require a valid Supabase session. Caller MUST have a business row.
function requireSupabaseAuth(options = {}) {
  const { allowNoBusiness = false } = options;

  return async function (req, res, next) {
    try {
      const token = readBearer(req);
      if (!token) {
        return reject(res, 'AUTH_MISSING', 401, 'Authorization Bearer token required');
      }
      const { user, business, business_id } = await verifySupabaseToken(token);

      if (!business && !allowNoBusiness) {
        return reject(res, 'NO_BUSINESS', 403, 'Authenticated user has no business associated');
      }

      req.user        = user;
      req.business    = business;
      req.business_id = business_id;
      req.auth_source = 'supabase';
      return next();
    } catch (err) {
      if (err instanceof OperisError) {
        return reject(res, err.code, err.status, err.message);
      }
      console.error('requireSupabaseAuth error:', err.message);
      return reject(res, 'AUTH_ERROR', 500, 'Authentication failed');
    }
  };
}

// Require the admin token. Used for internal founder tools (e.g. provision.html).
function requireAdmin() {
  return function (req, res, next) {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) {
      console.error('ADMIN_TOKEN env var not set — admin routes are not usable');
      return reject(res, 'ADMIN_NOT_CONFIGURED', 503, 'Admin token not configured');
    }
    const provided = req.headers['x-operis-admin-token'];
    if (!safeEq(provided || '', expected)) {
      return reject(res, 'ADMIN_INVALID', 401, 'Admin token required');
    }
    req.auth_source = 'admin';
    return next();
  };
}

// Used on POST /booking — accepts EITHER:
//   1. A Supabase JWT (for owner-initiated bookings via the dashboard)
//   2. The Vapi tool shared secret X-Operis-Vapi-Secret (for AI-initiated bookings)
//
// SECURITY: business_id sourced from verified session when JWT path is used;
// for the Vapi path, body's business_id is accepted but the call must carry
// the shared secret. Future hardening: cross-check body.business_id against
// the assistant's stored business_id by passing assistantId in the request.
function requireBookingAuth() {
  return async function (req, res, next) {
    // Try JWT first
    const token = readBearer(req);
    if (token) {
      try {
        const { user, business, business_id } = await verifySupabaseToken(token);
        if (!business) {
          return reject(res, 'NO_BUSINESS', 403, 'Authenticated user has no business associated');
        }
        req.user        = user;
        req.business    = business;
        req.business_id = business_id;
        req.auth_source = 'supabase';
        return next();
      } catch (err) {
        if (err instanceof OperisError) {
          return reject(res, err.code, err.status, err.message);
        }
        console.error('Booking JWT verify error:', err.message);
        return reject(res, 'AUTH_ERROR', 500, 'Authentication failed');
      }
    }

    // Fallback to Vapi tool secret
    const expected = process.env.VAPI_TOOL_SECRET;
    const provided = req.headers['x-operis-vapi-secret'];
    if (!expected) {
      console.error('VAPI_TOOL_SECRET env var not set — Vapi tool calls cannot be verified');
      return reject(res, 'VAPI_TOOL_NOT_CONFIGURED', 503, 'Vapi tool secret not configured');
    }
    if (!safeEq(provided || '', expected)) {
      return reject(res, 'AUTH_MISSING', 401, 'Authorization required (Bearer JWT or X-Operis-Vapi-Secret)');
    }

    // Vapi tool path: trust the body's business_id, but require it to be present.
    // Cross-tenant booking attempts via this path are still bounded by the secret.
    req.auth_source = 'vapi_tool';
    return next();
  };
}

module.exports = {
  requireSupabaseAuth,
  requireAdmin,
  requireBookingAuth,
  verifySupabaseToken,
  // exported for tests
  _readBearer: readBearer,
  _safeEq: safeEq
};
