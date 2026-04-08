const supabase = require('../config/supabase');
const { OperisError, handleError } = require('../utils/errorHandler');
const { requireFields } = require('../utils/validation');

// GET /availability?business_id=&staff_id=&date=YYYY-MM-DD
async function getAvailability(req, res) {
  try {
    const { business_id, staff_id, date } = req.query;

    requireFields(req.query, ['business_id', 'staff_id', 'date']);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new OperisError('date must be in YYYY-MM-DD format', 'INVALID_DATE', 400);
    }

    // Load business for slot duration and buffer
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('slot_duration_min, buffer_min, timezone')
      .eq('id', business_id)
      .single();

    if (bizError || !business) {
      throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
    }

    const slotDuration = business.slot_duration_min || 30;
    const buffer = business.buffer_min || 0;
    const stepMin = slotDuration + buffer;

    // Check for a date-specific override first
    const { data: overrideWindow } = await supabase
      .from('availability_windows')
      .select('start_time, end_time, is_blocked')
      .eq('staff_id', staff_id)
      .eq('business_id', business_id)
      .eq('override_date', date)
      .maybeSingle();

    let window = null;

    if (overrideWindow) {
      if (overrideWindow.is_blocked) {
        return res.json({ date, slots: [] });
      }
      window = overrideWindow;
    } else {
      // Fall back to recurring weekly window
      const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();

      const { data: recurringWindow } = await supabase
        .from('availability_windows')
        .select('start_time, end_time, is_blocked')
        .eq('staff_id', staff_id)
        .eq('business_id', business_id)
        .eq('day_of_week', dayOfWeek)
        .is('override_date', null)
        .maybeSingle();

      if (!recurringWindow || recurringWindow.is_blocked) {
        return res.json({ date, slots: [] });
      }

      window = recurringWindow;
    }

    // Load existing confirmed/pending bookings for this staff on this date
    const { data: bookings, error: bookError } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('staff_id', staff_id)
      .eq('business_id', business_id)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', `${date}T00:00:00.000Z`)
      .lte('start_time', `${date}T23:59:59.999Z`);

    if (bookError) throw new OperisError(bookError.message, 'DB_ERROR', 500);

    const bookedRanges = (bookings || []).map(b => [
      new Date(b.start_time).getTime(),
      new Date(b.end_time).getTime()
    ]);

    // Generate slots from window start to window end
    const windowStart = new Date(`${date}T${window.start_time}Z`);
    const windowEnd   = new Date(`${date}T${window.end_time}Z`);
    const now = new Date();
    const slots = [];

    let cursor = new Date(windowStart);

    while (cursor.getTime() + slotDuration * 60 * 1000 <= windowEnd.getTime()) {
      const slotStart = cursor.getTime();
      const slotEnd   = slotStart + slotDuration * 60 * 1000;

      if (cursor > now) {
        const conflict = bookedRanges.some(([bs, be]) => slotStart < be && slotEnd > bs);
        if (!conflict) {
          slots.push(cursor.toISOString());
        }
      }

      cursor = new Date(cursor.getTime() + stepMin * 60 * 1000);
    }

    return res.json({ date, slots });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { getAvailability };
