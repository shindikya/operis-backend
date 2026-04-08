const express = require('express');
const router = express.Router();
const { setupDemo, demoPage } = require('../controllers/demoController');

router.get('/', demoPage);
router.post('/setup', setupDemo);

module.exports = router;
