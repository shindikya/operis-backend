const express = require('express');
const router = express.Router();
const { postCallOutcome } = require('../controllers/attributionController');
const { requireSupabaseAuth } = require('../middleware/auth');

router.post('/:callId/outcome', requireSupabaseAuth(), postCallOutcome);

module.exports = router;
