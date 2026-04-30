const supabase = require('../config/supabase');
const { OperisError } = require('../utils/errorHandler');
const { upcomingHolidaysPromptBlock } = require('../config/thaiHolidays');

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
function getVapiConfig(business, language, context = {}) {
  const persona = business.persona_config ?? {};
  const { services = [], hours = [] } = context;

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
    messages:    [{ role: 'system', content: buildSystemPrompt(business, language, { services, hours }) }],
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
              },
              intake_answers: {
                type:        'array',
                description: 'Answers to the intake_questions block, in the order they were listed. Each item: { question: string, answer: string }. Omit if no intake questions are configured.',
                items: {
                  type: 'object',
                  properties: {
                    question: { type: 'string' },
                    answer:   { type: 'string' }
                  }
                }
              }
            },
            required: ['customer_phone', 'service_type', 'appointment_time', 'business_id']
          }
        },
        server: {
          url: 'https://operis-backend-production-3533.up.railway.app/booking'
        }
      }
    ]
  };

  // Thai: Cartesia voice. English: same voice (multilingual) until a dedicated EN voice is added.
  const voice = {
    provider:  'cartesia',
    voiceId:   process.env.CARTESIA_VOICE_TH || 'ccc7bb22-dcd0-42e4-822e-0731b950972f',
    model:     'sonic-multilingual',
    language:  isThai ? 'th' : 'en'
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

// Format a services list for inclusion in the prompt.
function formatServices(services, language) {
  if (!services || services.length === 0) return null;
  const isThai = language === 'th';
  return services.map(s => {
    const parts = [s.name];
    if (s.duration_min) parts.push(isThai ? `${s.duration_min} นาที` : `${s.duration_min} min`);
    if (s.price_cents) {
      const amount = (s.price_cents / 100).toFixed(0);
      const currency = (s.currency ?? '').toUpperCase() || (isThai ? 'THB' : '');
      parts.push(`${amount} ${currency}`.trim());
    }
    return `- ${parts.join(' — ')}`;
  }).join('\n');
}

// Format opening hours for the prompt. `hours` rows: { day_of_week, start_time, end_time }.
function formatHours(hours, language) {
  if (!hours || hours.length === 0) return null;
  const days = language === 'th'
    ? ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay = new Map();
  for (const h of hours) {
    if (!byDay.has(h.day_of_week)) byDay.set(h.day_of_week, []);
    byDay.get(h.day_of_week).push(`${String(h.start_time).slice(0, 5)}–${String(h.end_time).slice(0, 5)}`);
  }
  const lines = [];
  for (let d = 0; d < 7; d++) {
    if (byDay.has(d)) lines.push(`- ${days[d]}: ${byDay.get(d).join(', ')}`);
  }
  return lines.join('\n');
}

// Build system prompt in the appropriate language. `context` carries services + hours.
function buildSystemPrompt(business, language, context = {}) {
  const persona = business.persona_config ?? {};
  const { services = [], hours = [] } = context;
  const timezone = business.timezone ?? (language === 'th' ? 'Asia/Bangkok' : 'UTC');
  const servicesBlock = formatServices(services, language);
  const hoursBlock = formatHours(hours, language);
  const holidaysBlock = upcomingHolidaysPromptBlock(language, 90);
  const cancelWindow  = business.cancellation_window_hours ?? 24;
  const cancelPolicy  = business.cancellation_policy_text;
  // intake_questions: array of { question, type: 'yes_no' | 'short_answer' }
  const intakeQs = Array.isArray(business.intake_questions) ? business.intake_questions : [];

  if (language === 'th') {
    const aiName = persona.ai_name ?? 'ผู้ช่วย';
    const sections = [
      '# ตัวตน',
      `คุณคือ ${aiName} ผู้ช่วยต้อนรับเสมือนของ ${business.name}`,
      business.profession ? `ประเภทกิจการ: ${business.profession}` : null,
      `เขตเวลา: ${timezone}`,
      '',
      '# หน้าที่',
      '- รับจอง เลื่อน หรือยกเลิกนัดหมาย',
      '- ตอบคำถามเรื่องบริการ ราคา และเวลาเปิด-ปิด',
      '- ถ้าช่วยไม่ได้ ขอชื่อและเบอร์โทรเพื่อให้เจ้าของโทรกลับ',
      ''
    ];

    if (servicesBlock) {
      sections.push('# บริการที่เปิดรับ', servicesBlock, '');
    } else {
      sections.push('# บริการ', 'ยังไม่มีรายการบริการ — ถามลูกค้าว่าสนใจบริการอะไร และขอชื่อ/เบอร์เพื่อให้เจ้าของติดต่อกลับ', '');
    }

    if (hoursBlock) {
      sections.push('# เวลาทำการ', hoursBlock, '');
    }

    if (holidaysBlock) {
      sections.push(
        '# วันหยุดราชการ (ปิด)',
        'ห้ามรับจองในวันต่อไปนี้ ถ้าลูกค้าขอจองในวันเหล่านี้ ให้แจ้งว่าเป็นวันหยุดและเสนอวันถัดไป:',
        holidaysBlock,
        ''
      );
    }

    sections.push(
      '# นโยบายการยกเลิก',
      cancelPolicy
        ? cancelPolicy
        : `ลูกค้าต้องยกเลิกล่วงหน้าอย่างน้อย ${cancelWindow} ชั่วโมงก่อนเวลานัด`,
      `ถ้าลูกค้าโทรมาขอยกเลิกภายใน ${cancelWindow} ชั่วโมงก่อนเวลานัด ห้ามยกเลิกอัตโนมัติ ให้แจ้งว่าอยู่ในช่วงห้ามยกเลิก ขอชื่อและเหตุผล แล้วบอกว่าจะแจ้งเจ้าของให้ติดต่อกลับ`,
      ''
    );

    if (intakeQs.length > 0) {
      sections.push(
        '# คำถามรับข้อมูลลูกค้า',
        'หลังจากยืนยันเวลานัดและก่อนเรียก create_booking ให้ถามคำถามต่อไปนี้ตามลำดับ บันทึกคำตอบสั้นๆ และส่งทั้งหมดเป็น intake_answers ใน create_booking:',
        intakeQs.map((q, i) => `${i + 1}. ${q.question}`).join('\n'),
        ''
      );
    }

    // Caller-specific note (set per-call by /call/inbound via Vapi
    // assistantOverrides.variableValues.client_notes). Empty for new callers.
    sections.push(
      '# โน้ตเกี่ยวกับลูกค้าคนนี้ (จากเจ้าของ)',
      'ถ้ามีโน้ตด้านล่าง ให้ใช้ปรับการสนทนาเช่น เสนอเวลาที่ลูกค้าชอบ หลีกเลี่ยงเรื่องที่ลูกค้าไม่ชอบ:',
      '{{client_notes}}',
      ''
    );

    sections.push(
      '# ขั้นตอนการจอง',
      '1. ถามว่าต้องการบริการอะไร (ใช้ชื่อจากรายการด้านบนเท่านั้น)',
      '2. ถามวันและเวลาที่ต้องการ ตรวจสอบว่าอยู่ในเวลาทำการ',
      '3. ถ้ายังไม่รู้ชื่อลูกค้า ให้ถามชื่อ',
      '4. ทวนรายละเอียดให้ลูกค้ายืนยัน: บริการ วันเวลา ชื่อ',
      `5. เมื่อยืนยันแล้ว เรียก create_booking โดยแปลงเวลาท้องถิ่น (${timezone}) เป็น UTC ISO 8601 เช่น 2026-04-10T09:00:00Z`,
      '6. แจ้งสรุปให้ลูกค้าทราบอีกครั้งหลังจองสำเร็จ',
      '',
      '# กฎการสนทนา',
      '- พูดสั้น กระชับ ไม่เกิน 2 ประโยคต่อครั้ง',
      '- สุภาพเสมอ ลงท้ายด้วย ค่ะ หรือ ครับ',
      '- ห้ามแต่งข้อมูลที่ไม่มี (ราคา บริการ เวลาเปิดปิด) ถ้าไม่รู้ให้ขอให้เจ้าของติดต่อกลับ',
      `- ห้ามบอกว่าเป็น AI ถ้าไม่ถูกถาม ถ้าถูกถามให้บอกว่าเป็นผู้ช่วยเสมือนของ ${business.name}`,
      '- จบการสนทนาอย่างอบอุ่น',
      '',
      '# ตัวอย่างการจอง',
      'ลูกค้า: อยากจองพรุ่งนี้บ่ายสอง',
      'คุณ: ได้ค่ะ ต้องการบริการอะไรคะ?',
      'ลูกค้า: [ชื่อบริการ]',
      'คุณ: รับทราบค่ะ ขอชื่อที่จะจองหน่อยค่ะ',
      'ลูกค้า: ต้น',
      'คุณ: ยืนยันนะคะ คุณต้น [ชื่อบริการ] พรุ่งนี้ 14:00 ถูกต้องไหมคะ?',
      'ลูกค้า: ถูกต้องครับ',
      'คุณ: [เรียก create_booking] จองเรียบร้อยค่ะ แล้วเจอกันพรุ่งนี้ 14:00 นะคะ'
    );

    if (persona.instructions) {
      sections.push('', '# คำสั่งเพิ่มเติมจากเจ้าของ', persona.instructions);
    }

    return sections.filter(l => l !== null).join('\n');
  }

  // English prompt
  const sections = [
    '# Identity',
    `You are a virtual assistant for ${business.name}.`,
    business.profession ? `Business type: ${business.profession}.` : null,
    `Timezone: ${timezone}.`,
    '',
    '# Responsibilities',
    '- Book, reschedule, or cancel appointments.',
    '- Answer questions about services, pricing, and opening hours.',
    '- If you cannot help, take the caller\'s name and number so the owner can call back.',
    ''
  ];

  if (servicesBlock) {
    sections.push('# Services offered', servicesBlock, '');
  } else {
    sections.push('# Services', 'No service list is configured yet — ask the caller what they need and take their name and number for a callback.', '');
  }

  if (hoursBlock) {
    sections.push('# Opening hours', hoursBlock, '');
  }

  if (holidaysBlock) {
    sections.push(
      '# Public holidays (closed)',
      'Do NOT take bookings on these dates. If a caller requests one of these days, explain it is a public holiday and offer the next available day:',
      holidaysBlock,
      ''
    );
  }

  sections.push(
    '# Cancellation policy',
    cancelPolicy
      ? cancelPolicy
      : `Cancellations require at least ${cancelWindow} hours notice before the appointment.`,
    `If a caller asks to cancel within ${cancelWindow} hours of the appointment, do NOT auto-cancel. Tell them it is within the no-cancellation window, take their name and reason, and say you will flag it for the owner to follow up.`,
    ''
  );

  if (intakeQs.length > 0) {
    sections.push(
      '# Intake questions',
      'After confirming the slot but BEFORE calling create_booking, ask each of these questions in order. Capture short answers and pass them all in the intake_answers array of create_booking:',
      intakeQs.map((q, i) => `${i + 1}. ${q.question}`).join('\n'),
      ''
    );
  }

  // Owner-authored note about the caller, injected via Vapi
  // assistantOverrides.variableValues.client_notes at call start.
  sections.push(
    "# Note about this caller (from the owner)",
    'If the note below is non-empty, use it to personalise the call — e.g. prefer the times they like, avoid topics they dislike, refer to past visits:',
    '{{client_notes}}',
    ''
  );

  sections.push(
    '# Booking flow',
    '1. Ask which service they want (only offer services from the list above).',
    '2. Ask for the desired date and time; confirm it falls within opening hours.',
    '3. If the caller\'s name is unknown, ask for it.',
    '4. Read the details back for confirmation: service, date/time, name.',
    `5. Once confirmed, call create_booking. Convert the local time (${timezone}) to UTC ISO 8601 (e.g. 2026-04-10T09:00:00Z).`,
    '6. Confirm the booking to the caller after the tool call succeeds.',
    '',
    '# Conversation rules',
    '- Keep replies under 2 sentences.',
    '- Never invent prices, services, or hours that are not listed above — if unsure, offer a callback.',
    `- Do not say you are an AI unless directly asked. If asked, say you are a virtual assistant for ${business.name}.`,
    '- End calls warmly.',
    '',
    '# Booking example',
    'Caller: I\'d like to book tomorrow at 2pm.',
    'You: Of course — which service would you like?',
    'Caller: [service name].',
    'You: Got it. May I have your name for the booking?',
    'Caller: Alex.',
    'You: To confirm: Alex, [service name], tomorrow at 2pm — is that right?',
    'Caller: Yes.',
    'You: [call create_booking] You\'re booked for tomorrow at 2pm. See you then!'
  );

  if (persona.instructions) {
    sections.push('', '# Owner instructions', persona.instructions);
  }

  return sections.filter(l => l !== null).join('\n');
}

async function provisionBusiness({ businessId, phoneNumber, language = 'th' }) {
  // 1. Load business from Supabase
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, owner_name, profession, timezone, persona_config, cancellation_window_hours, cancellation_policy_text, intake_questions')
    .eq('id', businessId)
    .single();

  if (bizError || !business) {
    throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
  }

  // 2. Load services + opening hours so the bot prompt is grounded in real data
  const [{ data: services }, { data: hours }] = await Promise.all([
    supabase
      .from('services')
      .select('name, duration_min, price_cents, currency')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('availability_windows')
      .select('day_of_week, start_time, end_time')
      .eq('business_id', businessId)
      .order('day_of_week')
  ]);

  // 3. Create Vapi assistant with language-appropriate config
  const vapiAssistant = await vapiRequest('POST', '/assistant', getVapiConfig(business, language, {
    services: services ?? [],
    hours:    hours ?? []
  }));
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
