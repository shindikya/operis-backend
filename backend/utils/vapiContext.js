/**
 * Builds the context snapshot stored in call_sessions and used by the Vapi assistant.
 * All values are flat strings so Vapi can inject them via {{variable_name}} placeholders.
 */
function buildVapiContext({ business, client, lastBookings }) {
  return {
    business_name:        business.name        ?? '',
    business_profession:  business.profession  ?? '',
    business_timezone:    business.timezone    ?? 'UTC',

    is_known_client:          client ? 'true' : 'false',
    client_name:              client?.name           ?? '',
    client_phone:             client?.phone          ?? '',
    client_total_sessions:    String(client?.total_sessions ?? 0),
    client_notes:             client?.notes          ?? '',
    client_tags:              client?.tags?.join(', ') ?? '',

    last_bookings_count: String(lastBookings?.length ?? 0),
    last_bookings_summary: (lastBookings ?? [])
      .map(b => `${b.start_time} — ${b.status}`)
      .join(' | ')
  };
}

module.exports = { buildVapiContext };
