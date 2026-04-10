const express = require('express');
const router = express.Router();
const { provisionNew } = require('../controllers/provisionController');

router.post('/', provisionNew);

module.exports = router;
