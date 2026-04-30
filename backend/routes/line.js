const express = require('express');
const router = express.Router();
const { handleLineWebhook } = require('../controllers/lineController');

// Capture the raw request body so the controller can verify LINE's
// X-Line-Signature HMAC header. Express's standard JSON parser stringifies
// the parsed object, which won't byte-match what LINE signed.
function captureRawBody(req, res, buf) {
  req.rawBody = buf;
}

router.post('/', express.json({ verify: captureRawBody }), handleLineWebhook);

module.exports = router;
