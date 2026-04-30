// LINE Official Account webhook scaffold.
//
// Phase 1 (this scaffold): accept inbound LINE messaging events, log the raw
// payload, detect booking-intent keywords, and return a templated "coming
// soon" reply via LINE's reply API. Signature verification is implemented but
// not enforced if LINE_CHANNEL_SECRET is unset (so dev hits don't 401).
//
// Phase 2 (not built): map LINE userId → business + client, generate a real
// booking slot suggestion, hand off to the same Vapi/booking pipeline used
// for voice. See LINE_INTEGRATION.md.

const crypto = require('crypto');
const { handleError, OperisError } = require('../utils/errorHandler');

const BOOKING_KEYWORDS = [
  // Thai
  'นัด', 'จอง', 'นัดหมาย', 'ขอจอง', 'ขอนัด',
  // English
  'book', 'appointment', 'booking', 'reserve', 'schedule'
];

function detectBookingIntent(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return BOOKING_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

// Verify the X-Line-Signature header per LINE's HMAC-SHA256 + base64 spec.
// Skipped if LINE_CHANNEL_SECRET isn't set so dev/staging works without it.
function verifyLineSignature(req) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true; // permissive in dev

  const sig = req.get('X-Line-Signature');
  if (!sig) return false;

  // Express has already JSON-parsed req.body — recompute hash off the raw
  // body buffer captured by the verify hook in routes/line.js.
  const raw = req.rawBody;
  if (!raw) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(raw)
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// Send a reply via LINE Messaging API.
async function lineReply(replyToken, messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN not set — skipping reply');
    return;
  }

  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ replyToken, messages })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[line] reply failed:', res.status, text);
  }
}

// POST /webhooks/line
async function handleLineWebhook(req, res) {
  try {
    if (!verifyLineSignature(req)) {
      throw new OperisError('Invalid LINE signature', 'LINE_BAD_SIGNATURE', 401);
    }

    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    console.log(`[line] webhook received — ${events.length} event(s)`);

    // Always log the raw payload so we can replay later when phase 2 lands.
    console.log('[line] payload:', JSON.stringify(req.body));

    for (const event of events) {
      if (event.type !== 'message' || event.message?.type !== 'text') continue;

      const text   = event.message.text;
      const intent = detectBookingIntent(text);
      console.log(`[line] msg from ${event.source?.userId} intent=${intent}: ${text}`);

      if (event.replyToken) {
        const reply = intent
          ? 'ขอบคุณค่ะ! ระบบจองผ่าน LINE จะเปิดให้บริการเร็วๆ นี้ค่ะ ตอนนี้กรุณาโทรมาเพื่อจองนัดได้นะคะ 🙏\n\n(LINE booking coming soon — please call to book for now.)'
          : 'สวัสดีค่ะ ขณะนี้ระบบ LINE ยังอยู่ระหว่างการพัฒนา กรุณาโทรมาเพื่อจองนัดค่ะ\n\n(LINE chat is coming soon — please call to book.)';

        // Fire-and-forget: never block the 200 response to LINE.
        lineReply(event.replyToken, [{ type: 'text', text: reply }])
          .catch(err => console.error('[line] reply error:', err.message));
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { handleLineWebhook, detectBookingIntent };
