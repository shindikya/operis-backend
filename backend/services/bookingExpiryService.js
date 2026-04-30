// ═══════════════════════════════════════════════════════════════════════════
// Booking expiry sweeper — audit C5
// ═══════════════════════════════════════════════════════════════════════════
// Marks any booking with status='pending' AND expires_at < NOW() as 'expired'.
// Cancels any pending reminders for those bookings so the customer never gets
// an SMS for a phantom appointment.
// Runs every 5 minutes.
// ═══════════════════════════════════════════════════════════════════════════

const supabase = require('../config/supabase');

const TICK_MS = 5 * 60 * 1000;

async function sweep() {
  const now = new Date().toISOString();

  // Find expired pendings
  const { data: stale, error: readErr } = await supabase
    .from('bookings')
    .select('id, business_id')
    .eq('status', 'pending')
    .lt('expires_at', now)
    .limit(200);

  if (readErr) {
    console.error('[bookingExpiry] Query failed:', readErr.message);
    return;
  }
  if (!stale || stale.length === 0) return;

  console.log(`[bookingExpiry] Marking ${stale.length} pending booking(s) as expired`);

  const ids = stale.map(b => b.id);

  // Atomic flip: pending → expired only if still pending (race-safe vs. confirm).
  const { error: updErr } = await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .in('id', ids)
    .eq('status', 'pending');

  if (updErr) {
    console.error('[bookingExpiry] Update failed:', updErr.message);
    return;
  }

  // Cancel any associated reminders (defence in depth — pending bookings
  // shouldn't have reminders queued, but if a future code path queues them
  // before confirm, this catches them).
  const { error: remErr } = await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .in('booking_id', ids)
    .eq('status', 'pending');

  if (remErr) {
    console.error('[bookingExpiry] Reminder cleanup failed:', remErr.message);
  }
}

function startBookingExpiryCron() {
  sweep().catch(err => console.error('[bookingExpiry] Initial sweep failed:', err.message));
  setInterval(() => {
    sweep().catch(err => console.error('[bookingExpiry] Sweep failed:', err.message));
  }, TICK_MS);
  console.log('[bookingExpiry] Cron started — runs every 5 minutes');
}

module.exports = { startBookingExpiryCron, _sweep: sweep };
