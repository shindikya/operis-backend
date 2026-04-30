const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.post('/demo', async (req, res) => {
  const { businessName, language } = req.body || {};

  if (typeof businessName !== 'string' || !businessName.trim()) {
    return res.status(400).json({ error: 'businessName is required' });
  }
  if (!['th', 'en', 'both'].includes(language)) {
    return res.status(400).json({ error: 'language must be th | en | both' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .toString()
    .split(',')[0]
    .trim() || null;

  const { error } = await supabase
    .from('landing_page_demos')
    .insert({
      business_name: businessName.trim().slice(0, 200),
      language,
      ip,
      user_agent: (req.headers['user-agent'] || '').slice(0, 500) || null,
      referrer:   (req.headers['referer']    || '').slice(0, 500) || null,
    });

  if (error) {
    console.error('[landing] demo capture failed:', error.message);
    return res.status(500).json({ error: 'failed to log demo' });
  }

  res.json({ ok: true });
});

module.exports = router;
