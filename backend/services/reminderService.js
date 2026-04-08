const supabase = require('../config/supabase');
const { sendSms } = require('./smsService');

function formatBangkokTime(utcStr) {
  const d = new Date(new Date(utcStr).getTime() + 7 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

async function processReminders() {
  const now = new Date().toISOString();

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select(`
      id,
      type,
      bookings (
        start_time,
        clients ( name, phone ),
        services ( name ),
        businesses ( name )
      )
    `)
    .eq('status', 'pending')
    .eq('channel', 'sms')
    .in('type', ['confirmation', 'reminder_24h', 'reminder_1h'])
    .lte('scheduled_at', now)
    .limit(50);

  if (error) {
    console.error('[reminders] Query failed:', error.message);
    return;
  }

  if (!reminders || reminders.length === 0) return;

  console.log(`[reminders] Processing ${reminders.length} pending reminder(s)`);

  for (const reminder of reminders) {
    const booking  = reminder.bookings;
    if (!booking) continue;

    const client   = booking.clients;
    const service  = booking.services;
    const biz      = booking.businesses;

    if (!client?.phone) continue;

    const time    = formatBangkokTime(booking.start_time);
    const svcName = service?.name ?? 'บริการ';
    const bizName = biz?.name ?? '';

    let msg;
    if (reminder.type === 'confirmation') {
      msg = `ยืนยันนัดหมาย: ${svcName} เวลา ${time} ที่ ${bizName} ขอบคุณครับ`;
    } else if (reminder.type === 'reminder_24h') {
      msg = `เตือนความจำ: คุณมีนัด ${svcName} พรุ่งนี้ เวลา ${time} ที่ ${bizName}`;
    } else if (reminder.type === 'reminder_1h') {
      msg = `เตือนความจำ: คุณมีนัด ${svcName} ในอีก 1 ชั่วโมง เวลา ${time} ที่ ${bizName}`;
    } else {
      continue;
    }

    try {
      await sendSms(client.phone, msg);
      await supabase
        .from('reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', reminder.id);
    } catch (err) {
      console.error(`[reminders] Failed to send reminder ${reminder.id}:`, err.message);
      await supabase
        .from('reminders')
        .update({ status: 'failed' })
        .eq('id', reminder.id);
    }
  }
}

function startReminderCron() {
  processReminders();
  setInterval(processReminders, 60 * 60 * 1000);
  console.log('[reminders] Cron started — runs every hour');
}

module.exports = { startReminderCron };
