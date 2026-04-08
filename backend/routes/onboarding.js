const express = require('express');
const router = express.Router();
const { provision } = require('../controllers/onboardingController');

router.post('/provision', provision);

module.exports = router;
