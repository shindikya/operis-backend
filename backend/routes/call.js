const express = require('express');
const router = express.Router();
const { handleInbound, handleVapiCallback } = require('../controllers/callController');

// Twilio sends form-encoded body — must use urlencoded parser on this route
router.post('/inbound', express.urlencoded({ extended: false }), handleInbound);
router.post('/vapi-callback', handleVapiCallback);

module.exports = router;
