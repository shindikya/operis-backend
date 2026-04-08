# Operis API Reference

Base URL: `http://localhost:3000` (development)

All request and response bodies are JSON. All timestamps are UTC.

---

## Implemented Endpoints

---

### GET /

Health check.

**Request:** No body required.

**Response 200:**
```
Operis backend running
```

---

### POST /booking

Create a new booking.

**Request body:**
```json
{
  "name": "Jane Smith",
  "phone": "+15551234567",
  "time": "2026-04-01T14:00:00Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Full name of the person booking |
| `phone` | string | Yes | Contact phone number |
| `time` | string | Yes | Requested appointment time |

**Response 200:**
```json
{
  "status": "confirmed",
  "message": "Booking successful",
  "booking": {
    "id": 1743465600000,
    "name": "Jane Smith",
    "phone": "+15551234567",
    "time": "2026-04-01T14:00:00Z",
    "status": "confirmed"
  }
}
```

**Response 400 — missing fields:**
```json
{
  "error": "Missing required fields"
}
```

**Notes:**
- `id` is currently `Date.now()` (millisecond timestamp) — will be replaced by a Supabase UUID once DB is connected
- No persistence yet — booking is logged to console only
- No conflict detection yet

---

## Placeholder Endpoints (Not Yet Built)

---

### GET /booking/:id

Retrieve a booking by ID.

**Status:** Not implemented.

**Planned response 200:**
```json
{
  "id": "uuid",
  "name": "Jane Smith",
  "phone": "+15551234567",
  "time": "2026-04-01T14:00:00Z",
  "status": "confirmed",
  "created_at": "2026-03-31T10:00:00Z"
}
```

**Planned errors:** 404 if not found.

---

### PATCH /booking/:id

Reschedule an existing booking.

**Status:** Not implemented. `docs/reschedule.md` is empty — spec not yet written.

**Planned request body:**
```json
{
  "time": "2026-04-02T10:00:00Z"
}
```

**Planned errors:** 400 if new time unavailable, 404 if booking not found.

---

### GET /availability

Get available time slots.

**Status:** Not implemented. `docs/availability.md` is empty — spec not yet written.

**Planned query params:**
```
GET /availability?date=2026-04-01&business_id=uuid
```

**Planned response 200:**
```json
{
  "date": "2026-04-01",
  "slots": [
    "2026-04-01T09:00:00Z",
    "2026-04-01T10:00:00Z",
    "2026-04-01T14:00:00Z"
  ]
}
```

---

### POST /inbound-call

Twilio webhook — fires when a call arrives.

**Status:** Not implemented.

**Planned behavior:** Look up business by called number, look up client by caller number, build context, hand off to Vapi.

---

### POST /onboarding/business

Register a new business.

**Status:** Not implemented.

---

## Error Format

All errors return a JSON body:
```json
{
  "error": "Human-readable message"
}
```

HTTP status codes used:
| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request — validation failure |
| 404 | Resource not found |
| 500 | Internal server error |
