const express = require('express');
const router = express.Router();
const {
  createBooking,
  confirmBooking,
  getBooking,
  listBookings,
  cancelBooking,
  markDepositPaid
} = require('../controllers/bookingController');
const { requireSupabaseAuth, requireBookingAuth } = require('../middleware/auth');

// POST /booking — accepts JWT (owner UI) or Vapi tool secret (AI tool call)
router.post('/', requireBookingAuth(), createBooking);

// PATCH /booking/:id/confirm — used by Vapi to flip pending → confirmed,
// or by the owner's UI. Same auth surface as POST /.
router.patch('/:id/confirm', requireBookingAuth(), confirmBooking);

// Cancel is callable by both owner UI and AI. The controller enforces the
// cancellation window when auth_source !== 'supabase'.
router.patch('/:id/cancel', requireBookingAuth(), cancelBooking);

// Deposit-paid toggle: owner-only.
router.patch('/:id/deposit-paid', requireSupabaseAuth(), markDepositPaid);

router.get('/business/:business_id', requireSupabaseAuth(), listBookings);
router.get('/:id',                    requireSupabaseAuth(), getBooking);

module.exports = router;
