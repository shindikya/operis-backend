// PromptPay QR generation + upload to Supabase Storage.
//
// PromptPay uses the EMVCo Merchant Presented Mode Visual Code spec with a
// Thai-specific Tag 29 (Account Information) carrying the merchant ID
// (mobile number or 13-digit national ID). We build the payload string,
// CRC-16/CCITT-FALSE checksum it, render a PNG, and upload to a public bucket.
//
// Returns the public URL so the SMS sender can include it as a link.

const QRCode = require('qrcode');
const supabase = require('../config/supabase');

const STORAGE_BUCKET = 'promptpay-qr'; // public bucket — see README

// ── Payload builders ─────────────────────────────────────────────────────

function tlv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

// Normalise a Thai phone number or national ID to PromptPay's wire format.
// Phone: 10 digits → "0066" + last 9 digits, padded with leading 0 to 13 chars.
// National ID: 13 digits → as-is.
function normalisePromptpayId(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 13) return digits; // national ID
  // Phone — convert to 13-char "00669XXXXXXXX" form
  const last9 = digits.slice(-9);
  return ('0000000000000' + '0066' + last9).slice(-13);
}

// CRC-16/CCITT-FALSE per EMVCo spec
function crc16ccitt(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Build the EMVCo payload string for a PromptPay payment.
function buildPromptpayPayload({ promptpayId, amountThb }) {
  const id = normalisePromptpayId(promptpayId);

  const merchantInfo = tlv('00', 'A000000677010111') + tlv('01', id);
  const isDynamic    = typeof amountThb === 'number' && amountThb > 0;

  let payload = '';
  payload += tlv('00', '01');                           // Payload Format Indicator
  payload += tlv('01', isDynamic ? '12' : '11');        // PoI: 11=static 12=dynamic
  payload += tlv('29', merchantInfo);                   // PromptPay merchant
  payload += tlv('53', '764');                          // THB
  payload += tlv('58', 'TH');
  if (isDynamic) {
    payload += tlv('54', amountThb.toFixed(2));
  }
  payload += '6304';                                    // CRC tag + length
  payload += crc16ccitt(payload);
  return payload;
}

// ── QR rendering + upload ────────────────────────────────────────────────

async function renderQrPngBuffer(payload) {
  return QRCode.toBuffer(payload, {
    type:   'png',
    width:  512,
    margin: 2,
    errorCorrectionLevel: 'M'
  });
}

// Generates a PromptPay QR PNG, uploads to Supabase Storage, returns public URL.
// `bookingId` keeps the filename unique and makes audit trivial.
async function generateAndUpload({ promptpayId, amountThb, bookingId }) {
  const payload = buildPromptpayPayload({ promptpayId, amountThb });
  const buffer  = await renderQrPngBuffer(payload);

  const path = `bookings/${bookingId}.png`;

  const { error: uploadErr } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true });

  if (uploadErr) {
    throw new Error(`PromptPay QR upload failed: ${uploadErr.message}`);
  }

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

module.exports = {
  buildPromptpayPayload,
  generateAndUpload,
  normalisePromptpayId,
  STORAGE_BUCKET
};
