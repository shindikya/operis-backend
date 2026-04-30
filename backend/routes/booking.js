const express = require('express');
const router = express.Router();
const {
  createBooking,
  confirmBooking,
  getBooking,
  listBookings,
  cancelBooking
} = require('../controllers/bookingController');
const { requireSupabaseAuth, requireBookingAuth } = require('../middleware/auth');

// POST /booking — accepts JWT (owner UI) or Vapi tool secret (AI tool call)
router.post('/', requireBookingAuth(), createBooking);

// PATCH /booking/:id/confirm — used by Vapi to flip pending → confirmed,
// or by the owner's UI. Same auth surface as POST /.
router.patch('/:id/confirm', requireBookingAuth(), confirmBooking);

// All read/cancel routes are owner-scoped (Supabase JWT only)
router.get('/business/:business_id', requireSupabaseAuth(), listBookings);
router.get('/:id',                    requireSupabaseAuth(), getBooking);
router.patch('/:id/cancel',           requireSupabaseAuth(), cancelBooking);

module.exports = router;
