const express = require('express');
const router = express.Router();
const { provisionNew } = require('../controllers/provisionController');
const { requireAdmin } = require('../middleware/auth');

// /provision is an internal founder tool per CONTEXT.md — gated by ADMIN_TOKEN.
router.post('/', requireAdmin(), provisionNew);

module.exports = router;
