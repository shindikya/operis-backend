const express = require('express');
const router = express.Router();
const { handleInbound, handleVapiCallback } = require('../controllers/callController');
const { verifyTwilioSignature, verifyVapiSecret } = require('../middleware/webhookAuth');

// Twilio sends form-encoded body — must be parsed BEFORE signature verification
// because validateRequest hashes the parsed params (in addition to the URL).
router.post('/inbound',
  express.urlencoded({ extended: false }),
  verifyTwilioSignature(),
  handleInbound
);

// Vapi sends JSON. Body parsing is handled globally by app.use(express.json())
// in server.js, but that limit applies. The middleware checks a shared secret
// in the X-Vapi-Secret header.
router.post('/vapi-callback',
  verifyVapiSecret(),
  handleVapiCallback
);

module.exports = router;
