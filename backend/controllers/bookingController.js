const supabase = require('../config/supabase');
const { OperisError, handleError } = require('../utils/errorHandler');
const { requireFields, validatePhone, validateFuture } = require('../utils/validation');

// POST /booking
async function createBooking(req, res) {
  try {
    const { business_id, staff_id, client, service_id, source, notes } = req.body;
    const start_time = req.body.start_time || req.body.appointment_time;

    requireFields(req.body, ['business_id']);
    if (!start_time) throw new OperisError('Missing required field: start_time or appointment_time', 'MISSING_FIELDS', 400, { missing: ['start_time'] });
    requireFields(client || {}, ['name', 'phone']);
    validatePhone(client.phone);
    validateFuture(start_time, 'start_time');

    // Resolve staff_id: use provided value, or fall back to first active staff for this business
    let resolvedStaffId = staff_id || null;
    if (!resolvedStaffId) {
      const { data: firstStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('business_id', business_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (firstStaff) resolvedStaffId = firstStaff.id;
    }

    // Look up existing client by (business_id, phone)
    const { data: existingClient, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('business_id', business_id)
      .eq('phone', client.phone)
      .maybeSingle();

    if (lookupError) throw new OperisError(lookupError.message, 'DB_ERROR', 500);

    let clientRecord;
    if (existingClient) {
      clientRecord = existingClient;
    } else {
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({ business_id, phone: client.phone, name: client.name })
        .select('id')
        .single();

      if (insertError) throw new OperisError(insertError.message, 'DB_ERROR', 500);
      clientRecord = newClient;
    }

    // Resolve duration: from service row, or fall back to business slot_duration_min
    let durationMin = 60;

    if (service_id) {
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('duration_min, is_active')
        .eq('id', service_id)
        .single();

      if (serviceError || !service) {
        throw new OperisError('Service not found', 'SERVICE_NOT_FOUND', 404);
      }
      if (!service.is_active) {
        throw new OperisError('Service is not active', 'SERVICE_INACTIVE', 400);
      }
      durationMin = service.duration_min;
    } else {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('slot_duration_min')
        .eq('id', business_id)
        .single();

      if (businessError || !business) {
        throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
      }
      if (business.slot_duration_min) durationMin = business.slot_duration_min;
    }

    const end_time = new Date(
      new Date(start_time).getTime() + durationMin * 60 * 1000
    ).toISOString();

    // Insert booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        business_id,
        staff_id: resolvedStaffId,
        client_id: clientRecord.id,
        service_id: service_id || null,
        start_time,
        end_time,
        status: 'confirmed',
        source: source || 'ui',
        notes: notes || null
      })
      .select()
      .single();

    if (bookingError) {
      if (bookingError.code === '23P01' || bookingError.code === '23505') {
        throw new OperisError('This time slot is already booked', 'BOOKING_CONFLICT', 409);
      }
      throw new OperisError(bookingError.message, 'DB_ERROR', 500);
    }

    // Increment client total_sessions — soft failure: never blocks the booking response
    supabase.rpc('increment_client_sessions', { client_id_input: clientRecord.id })
      .then(({ error }) => {
        if (error) console.error('increment_client_sessions failed:', error.message);
      });

    // Queue confirmation reminder
    await supabase.from('reminders').insert({
      business_id,
      booking_id: booking.id,
      type: 'confirmation',
      channel: 'sms',
      status: 'pending',
      scheduled_at: new Date().toISOString()
    });

    return res.status(201).json({ booking });
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /booking/:id
async function getBooking(req, res) {
  try {
    const { id } = req.params;

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        client:clients(id, name, phone, email),
        service:services(id, name, duration_min, price_cents),
        staff:staff(id, name, role)
      `)
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw new OperisError('Booking not found', 'BOOKING_NOT_FOUND', 404);
    }

    return res.json({ booking });
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /booking/business/:business_id
async function listBookings(req, res) {
  try {
    const { business_id } = req.params;
    const { status, from, to, limit = 50 } = req.query;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        client:clients(id, name, phone),
        service:services(id, name, duration_min),
        staff:staff(id, name, role)
      `)
      .eq('business_id', business_id)
      .order('start_time', { ascending: true })
      .limit(Number(limit));

    if (status) query = query.eq('status', status);
    if (from)   query = query.gte('start_time', from);
    if (to)     query = query.lte('start_time', to);

    const { data: bookings, error } = await query;

    if (error) throw new OperisError(error.message, 'DB_ERROR', 500);

    return res.json({ bookings });
  } catch (err) {
    return handleError(res, err);
  }
}

// PATCH /booking/:id/cancel
async function cancelBooking(req, res) {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new OperisError('Booking not found', 'BOOKING_NOT_FOUND', 404);
    }

    if (existing.status === 'cancelled') {
      throw new OperisError('Booking is already cancelled', 'ALREADY_CANCELLED', 400);
    }

    const { data: booking, error: cancelError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (cancelError) throw new OperisError(cancelError.message, 'DB_ERROR', 500);

    // Cancel pending reminders for this booking
    await supabase
      .from('reminders')
      .update({ status: 'cancelled' })
      .eq('booking_id', id)
      .eq('status', 'pending');

    return res.json({ booking });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { createBooking, getBooking, listBookings, cancelBooking };
