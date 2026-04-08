const supabase = require('../config/supabase');
const { OperisError } = require('../utils/errorHandler');

// Thin wrapper around the Vapi REST API
async function vapiRequest(method, path, body) {
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}` }
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`https://api.vapi.ai${path}`, options);

  if (!res.ok) {
    const text = await res.text();
    throw new OperisError(`Vapi API error: ${text}`, 'VAPI_ERROR', 502);
  }

  if (method === 'DELETE') return null;
  return res.json();
}

// Build the full Vapi assistant config for a given language
function getVapiConfig(business, language) {
  const persona = business.persona_config ?? {};

  const isThai = language === 'th';

  const transcriber = isThai
    ? {
        provider:       'deepgram',
        model:          'nova-2',
        language:       'th',
        endpointing:    400,
        smartFormat:    true
      }
    : {
        provider:       'deepgram',
        model:          'nova-2',
        language:       'en-US',
        endpointing:    300,
        smartFormat:    true
      };

  const model = {
    provider:    'openai',
    model:       'gpt-4o-mini',
    temperature: 0.7,
    maxTokens:   250,
    messages:    [{ role: 'system', content: buildSystemPrompt(business, language) }],
    tools: [
      {
        type: 'function',
        function: {
          name:        'create_booking',
          description: 'Create a booking for the caller. Call this once you have confirmed the service type and appointment time with the caller.',
          parameters: {
            type:       'object',
            properties: {
              customer_phone: {
                type:        'string',
                description: 'Caller phone number in E.164 format (e.g. +66812345678)'
              },
              service_type: {
                type:        'string',
                description: 'The service the caller wants to book'
              },
              appointment_time: {
                type:        'string',
                description: 'Appointment date and time in UTC ISO 8601 format (e.g. 2026-04-10T09:00:00Z)'
              },
              business_id: {
                type:        'string',
                description: 'Business identifier — set automatically',
                default:     business.id
              }
            },
            required: ['customer_phone', 'service_type', 'appointment_time', 'business_id']
          },
          server: {
            url: 'https://operis-backend-production-3533.up.railway.app/booking'
          }
        }
      }
    ]
  };

  const voice = isThai
    ? {
        provider:  'cartesia',
        voiceId:   process.env.CARTESIA_VOICE_TH,
        model:     'sonic-multilingual',
        language:  'th'
      }
    : {
        provider:  'cartesia',
        voiceId:   process.env.CARTESIA_VOICE_EN,
        model:     'sonic-multilingual',
        language:  'en'
      };

  const firstMessage = persona.greeting
    ?? (isThai
      ? `สวัสดีค่ะ ${business.name} รับสายค่ะ ให้หนูช่วยอะไรได้บ้างคะ`
      : `Thank you for calling ${business.name}. How can I help you today?`);

  const config = {
    name:         `${business.name} Assistant`,
    transcriber,
    model,
    voice,
    firstMessage
  };

  if (isThai) {
    config.backchannel = { enabled: true };
  }

  return config;
}

// Build system prompt in the appropriate language
function buildSystemPrompt(business, language) {
  const persona = business.persona_config ?? {};

  if (language === 'th') {
    const aiName = persona.ai_name ?? 'ผู้ช่วย';
    const lines = [
      `คุณคือ ${aiName} ผู้ช่วยต้อนรับเสมือนของ ${business.name}`,
      `เจ้าของคือ ${business.owner_name ?? business.name}`,
      `ประกอบอาชีพ ${business.profession ?? 'ให้บริการ'}`,
      `เขตเวลา: ${business.timezone ?? 'Asia/Bangkok'}`,
      '',
      'หน้าที่ของคุณ:',
      '- รับนัดหมายและจองคิว',
      '- เลื่อนนัดหมาย',
      '- ยกเลิกนัดหมาย',
      '- ตอบคำถามเกี่ยวกับบริการและเวลาที่ว่าง',
      '- ถ้าช่วยไม่ได้ขอชื่อและเบอร์โทรเพื่อให้เจ้าของติดต่อกลับ',
      '',
      'กฎสำคัญ:',
      '- พูดสั้นและกระชับ ไม่เกิน 2 ประโยคต่อครั้ง',
      '- ใช้คำสุภาพเสมอ ลงท้ายด้วย ค่ะ หรือ ครับ',
      '- ห้ามบอกว่าเป็น AI ถ้าไม่ถูกถาม',
      `- ถ้าถูกถามให้บอกว่าเป็นผู้ช่วยเสมือนของ ${business.name}`,
      '- จบการสนทนาอย่างสุภาพเสมอ',
      '- อย่าแต่งข้อมูลที่ไม่มี'
    ];

    if (persona.instructions) {
      lines.push('', persona.instructions);
    }

    return lines.join('\n');
  }

  // English prompt
  const lines = [
    `You are a virtual assistant for ${business.name}.`
  ];

  if (business.profession) {
    lines.push(`The business specialises in ${business.profession}.`);
  }
  if (business.timezone) {
    lines.push(`All appointment times are in the ${business.timezone} timezone.`);
  }

  lines.push(
    'Your role is to help callers book, reschedule, or cancel appointments, and answer questions about services and availability.',
    'If you cannot help, take the caller\'s name and number so the owner can call back.',
    'Rules: respond in under 2 sentences per turn. Never reveal you are an AI unless directly asked — if asked, say you are a virtual assistant for ' + business.name + '. Always end calls warmly. Never make up information.'
  );

  if (persona.instructions) {
    lines.push(persona.instructions);
  }

  return lines.join(' ');
}

async function provisionBusiness({ businessId, phoneNumber, language = 'th' }) {
  // 1. Load business from Supabase
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, owner_name, profession, timezone, persona_config')
    .eq('id', businessId)
    .single();

  if (bizError || !business) {
    throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
  }

  // 2. Create Vapi assistant with language-appropriate config
  const vapiAssistant = await vapiRequest('POST', '/assistant', getVapiConfig(business, language));
  const vapiAgentId = vapiAssistant.id;

  // 3. Write to Supabase — roll back Vapi agent if any step fails
  try {
    // 4. Insert into phone_numbers
    const { error: phoneError } = await supabase
      .from('phone_numbers')
      .insert({
        business_id:   businessId,
        number:        phoneNumber,
        vapi_agent_id: vapiAgentId,
        status:        'active',
        provider:      'twilio'
      });

    if (phoneError) throw new OperisError(phoneError.message, 'DB_ERROR', 500);

    // 5. Mark business onboarding complete
    const { error: bizUpdateError } = await supabase
      .from('businesses')
      .update({ onboarding_complete: true })
      .eq('id', businessId);

    if (bizUpdateError) throw new OperisError(bizUpdateError.message, 'DB_ERROR', 500);

    // 6. Update onboarding_state
    const { error: stateError } = await supabase
      .from('onboarding_state')
      .update({
        step_integrations: true,
        completed_at:      new Date().toISOString()
      })
      .eq('business_id', businessId);

    if (stateError) throw new OperisError(stateError.message, 'DB_ERROR', 500);

  } catch (err) {
    // Rollback: delete the Vapi agent that was just created
    console.error('[ROLLBACK] Supabase write failed after Vapi agent created — deleting agent:', vapiAgentId);
    try {
      await vapiRequest('DELETE', `/assistant/${vapiAgentId}`);
      console.error('[ROLLBACK] Vapi agent deleted successfully');
    } catch (rollbackErr) {
      console.error('[ROLLBACK] Failed to delete Vapi agent:', rollbackErr.message);
    }
    throw err;
  }

  // 7. Return result
  return {
    success:       true,
    vapi_agent_id: vapiAgentId,
    phone_number:  phoneNumber,
    dashboard_url: `/dashboard/${businessId}`
  };
}

module.exports = { provisionBusiness, getVapiConfig, buildSystemPrompt };
