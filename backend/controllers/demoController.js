const { handleError } = require('../utils/errorHandler');
const { OperisError } = require('../utils/errorHandler');
const { requireFields } = require('../utils/validation');

// POST /demo/setup
async function setupDemo(req, res) {
  try {
    requireFields(req.body, ['shop_name', 'language']);

    const { shop_name, language } = req.body;

    if (language !== 'th' && language !== 'en') {
      throw new OperisError('language must be "th" or "en"', 'INVALID_LANGUAGE', 400);
    }

    const agentId = process.env.DEMO_VAPI_AGENT_ID;
    if (!agentId) {
      throw new OperisError('DEMO_VAPI_AGENT_ID is not configured', 'CONFIG_ERROR', 500);
    }

    const greeting = language === 'th'
      ? `สวัสดีค่ะ ${shop_name} รับสายค่ะ ให้หนูช่วยอะไรได้บ้างคะ`
      : `Hi thanks for calling ${shop_name}, how can I help you today?`;

    const systemPrompt = language === 'th'
      ? `คุณคือผู้ช่วยต้อนรับเสมือนของ ${shop_name} พูดสั้นและกระชับ ไม่เกิน 2 ประโยคต่อครั้ง ใช้คำสุภาพเสมอ ลงท้ายด้วย ค่ะ หรือ ครับ ห้ามบอกว่าเป็น AI ถ้าไม่ถูกถาม ถ้าถูกถามให้บอกว่าเป็นผู้ช่วยเสมือนของ ${shop_name} จบการสนทนาอย่างสุภาพเสมอ อย่าแต่งข้อมูลที่ไม่มี`
      : `You are a virtual assistant for ${shop_name}. Respond in under 2 sentences per turn. Never reveal you are an AI unless directly asked — if asked, say you are a virtual assistant for ${shop_name}. Always end calls warmly. Never make up information.`;

    // Update the shared demo agent on Vapi
    const vapiRes = await fetch(`https://api.vapi.ai/assistant/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        firstMessage: greeting,
        model: {
          provider:    'openai',
          model:       'gpt-4o-mini',
          temperature: 0.7,
          maxTokens:   250,
          messages:    [{ role: 'system', content: systemPrompt }]
        }
      })
    });

    if (!vapiRes.ok) {
      const text = await vapiRes.text();
      throw new OperisError(`Vapi update failed: ${text}`, 'VAPI_ERROR', 502);
    }

    return res.json({
      success:     true,
      shop_name,
      language,
      demo_number: process.env.DEMO_TWILIO_NUMBER ?? null
    });

  } catch (err) {
    return handleError(res, err);
  }
}

// GET /demo — mobile demo setup page
function demoPage(req, res) {
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Operis Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0a0e1a;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 24px 60px;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #3b82f6;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }

    .tagline {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 48px;
    }

    .card {
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    label {
      font-size: 13px;
      color: #9ca3af;
      display: block;
      margin-bottom: 8px;
    }

    input[type="text"] {
      width: 100%;
      padding: 18px 16px;
      font-size: 18px;
      background: #131929;
      border: 1.5px solid #1e2a42;
      border-radius: 12px;
      color: #ffffff;
      outline: none;
      -webkit-appearance: none;
    }
    input[type="text"]:focus {
      border-color: #3b82f6;
    }
    input[type="text"]::placeholder {
      color: #4b5563;
    }

    .lang-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .lang-btn {
      padding: 18px;
      font-size: 18px;
      font-weight: 600;
      border: 1.5px solid #1e2a42;
      border-radius: 12px;
      background: #131929;
      color: #9ca3af;
      cursor: pointer;
      text-align: center;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .lang-btn.selected {
      background: #1d4ed8;
      border-color: #3b82f6;
      color: #ffffff;
    }

    .setup-btn {
      width: 100%;
      padding: 20px;
      font-size: 18px;
      font-weight: 700;
      background: #3b82f6;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: opacity 0.15s;
    }
    .setup-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .status {
      text-align: center;
      font-size: 15px;
      min-height: 24px;
      color: #9ca3af;
    }

    .success-box {
      display: none;
      background: #052e16;
      border: 1.5px solid #16a34a;
      border-radius: 16px;
      padding: 28px 24px;
      text-align: center;
      gap: 16px;
      flex-direction: column;
    }
    .success-box.visible {
      display: flex;
    }

    .success-label {
      font-size: 14px;
      color: #4ade80;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .success-name {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
    }

    .demo-number {
      font-size: 28px;
      font-weight: 700;
      color: #3b82f6;
      letter-spacing: 1px;
    }

    .call-btn {
      display: block;
      width: 100%;
      padding: 20px;
      font-size: 20px;
      font-weight: 700;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      text-decoration: none;
      text-align: center;
      -webkit-tap-highlight-color: transparent;
    }

    .reset-btn {
      background: none;
      border: 1.5px solid #374151;
      color: #9ca3af;
      padding: 14px;
      border-radius: 10px;
      font-size: 14px;
      cursor: pointer;
      width: 100%;
      -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div class="logo">Operis</div>
  <div class="tagline">AI Receptionist Demo</div>

  <div class="card" id="form-card">
    <div>
      <label>ชื่อร้าน / Shop name</label>
      <input type="text" id="shop-name" placeholder="ชื่อร้าน / Shop name" autocomplete="off">
    </div>

    <div>
      <label>ภาษา / Language</label>
      <div class="lang-row">
        <button class="lang-btn selected" id="btn-th" onclick="selectLang('th')">🇹🇭 Thai</button>
        <button class="lang-btn" id="btn-en" onclick="selectLang('en')">🇬🇧 English</button>
      </div>
    </div>

    <button class="setup-btn" id="setup-btn" onclick="submitSetup()">ตั้งค่า Demo</button>
    <div class="status" id="status-msg"></div>
  </div>

  <div class="card success-box" id="success-card">
    <div class="success-label">พร้อมแล้ว!</div>
    <div class="success-name" id="success-name"></div>
    <div style="font-size:13px; color:#6b7280;">โทรหาเบอร์นี้เพื่อทดลอง</div>
    <div class="demo-number" id="demo-number"></div>
    <a class="call-btn" id="call-link" href="#">📞 โทรเลย / Call Now</a>
    <button class="reset-btn" onclick="resetForm()">↩ ตั้งค่าใหม่ / Reset</button>
  </div>

  <script>
    var selectedLang = 'th';

    function selectLang(lang) {
      selectedLang = lang;
      document.getElementById('btn-th').classList.toggle('selected', lang === 'th');
      document.getElementById('btn-en').classList.toggle('selected', lang === 'en');
    }

    async function submitSetup() {
      var shopName = document.getElementById('shop-name').value.trim();
      if (!shopName) {
        document.getElementById('status-msg').textContent = 'กรุณาใส่ชื่อร้าน';
        return;
      }

      var btn = document.getElementById('setup-btn');
      var status = document.getElementById('status-msg');
      btn.disabled = true;
      status.textContent = 'กำลังตั้งค่า...';

      try {
        var res = await fetch('/demo/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_name: shopName, language: selectedLang })
        });

        var data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Setup failed');
        }

        document.getElementById('success-name').textContent = data.shop_name;
        document.getElementById('demo-number').textContent = data.demo_number ?? '—';
        var callLink = document.getElementById('call-link');
        if (data.demo_number) {
          callLink.href = 'tel:' + data.demo_number;
        } else {
          callLink.style.display = 'none';
        }

        document.getElementById('form-card').style.display = 'none';
        document.getElementById('success-card').classList.add('visible');

      } catch (err) {
        status.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
        btn.disabled = false;
      }
    }

    function resetForm() {
      document.getElementById('shop-name').value = '';
      document.getElementById('status-msg').textContent = '';
      document.getElementById('setup-btn').disabled = false;
      document.getElementById('success-card').classList.remove('visible');
      document.getElementById('form-card').style.display = '';
      document.getElementById('call-link').style.display = '';
      selectLang('th');
    }
  </script>
</body>
</html>`;

  res.type('text/html').send(html);
}

module.exports = { setupDemo, demoPage };
