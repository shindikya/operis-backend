const express = require('express');
const router = express.Router();
const { getAttribution, exportAttributionCsv } = require('../controllers/attributionController');
const { requireSupabaseAuth } = require('../middleware/auth');

router.get('/:businessId/attribution',        requireSupabaseAuth(), getAttribution);
router.get('/:businessId/attribution/export', requireSupabaseAuth(), exportAttributionCsv);

module.exports = router;
