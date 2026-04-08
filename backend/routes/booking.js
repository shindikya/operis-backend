const express = require('express');
const router = express.Router();
const {
  createBooking,
  getBooking,
  listBookings,
  cancelBooking
} = require('../controllers/bookingController');

router.post('/', createBooking);
router.get('/business/:business_id', listBookings);
router.get('/:id', getBooking);
router.patch('/:id/cancel', cancelBooking);

module.exports = router;
