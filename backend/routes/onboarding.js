const express = require('express');
const router = express.Router();
const { provision } = require('../controllers/onboardingController');
const { requireSupabaseAuth } = require('../middleware/auth');

// Onboarding-completion provision: requires an authenticated owner who already
// has a business row (created via /provision earlier in onboarding).
router.post('/provision', requireSupabaseAuth(), provision);

module.exports = router;
