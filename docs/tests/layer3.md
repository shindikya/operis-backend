# Layer 3 — Thunder Client Test Requests

Base URL: `http://localhost:3000`

Replace all `uuid` placeholders with real IDs from your Supabase tables before running.

---

## POST /booking — success

**Method:** POST
**URL:** `http://localhost:3000/booking`
**Headers:** `Content-Type: application/json`

**Body:**
```json
{
  "business_id": "YOUR_BUSINESS_UUID",
  "staff_id": "YOUR_STAFF_UUID",
  "client": {
    "name": "Jane Smith",
    "phone": "+14155550123"
  },
  "start_time": "2026-05-01T14:00:00.000Z"
}
```

**Expected 201:**
```json
{
  "booking": {
    "id": "uuid",
    "business_id": "uuid",
    "staff_id": "uuid",
    "client_id": "uuid",
    "service_id": null,
    "start_time": "2026-05-01T14:00:00+00:00",
    "end_time": "2026-05-01T14:30:00+00:00",
    "status": "confirmed"
  }
}
```

---

## POST /booking — with service_id

**Method:** POST
**URL:** `http://localhost:3000/booking`
**Headers:** `Content-Type: application/json`

**Body:**
```json
{
  "business_id": "YOUR_BUSINESS_UUID",
  "staff_id": "YOUR_STAFF_UUID",
  "service_id": "YOUR_SERVICE_UUID",
  "client": {
    "name": "Jane Smith",
    "phone": "+14155550123"
  },
  "start_time": "2026-05-01T15:00:00.000Z"
}
```

**Expected 201:** booking with end_time = start_time + service.duration_min

---

## POST /booking — missing fields

**Body:**
```json
{
  "business_id": "YOUR_BUSINESS_UUID"
}
```

**Expected 400:**
```json
{
  "error": "Missing required fields: staff_id, start_time",
  "code": "MISSING_FIELDS",
  "details": { "missing": ["staff_id", "start_time"] }
}
```

---

## POST /booking — invalid phone

**Body:**
```json
{
  "business_id": "YOUR_BUSINESS_UUID",
  "staff_id": "YOUR_STAFF_UUID",
  "client": { "name": "Jane", "phone": "555-1234" },
  "start_time": "2026-05-01T14:00:00.000Z"
}
```

**Expected 400:**
```json
{
  "error": "Phone must be in E.164 format (e.g. +14155550123)",
  "code": "INVALID_PHONE"
}
```

---

## POST /booking — past start_time

**Body:**
```json
{
  "business_id": "YOUR_BUSINESS_UUID",
  "staff_id": "YOUR_STAFF_UUID",
  "client": { "name": "Jane", "phone": "+14155550123" },
  "start_time": "2020-01-01T10:00:00.000Z"
}
```

**Expected 400:**
```json
{
  "error": "start_time must be in the future",
  "code": "DATETIME_NOT_FUTURE"
}
```

---

## POST /booking — conflict (same staff, same time)

Send the same valid booking request twice.

**Expected 409 on second request:**
```json
{
  "error": "This time slot is already booked",
  "code": "BOOKING_CONFLICT"
}
```

---

## GET /booking/:id — success

**Method:** GET
**URL:** `http://localhost:3000/booking/YOUR_BOOKING_UUID`

**Expected 200:**
```json
{
  "booking": {
    "id": "uuid",
    "status": "confirmed",
    "start_time": "...",
    "end_time": "...",
    "client": { "id": "uuid", "name": "Jane Smith", "phone": "+14155550123" },
    "service": null,
    "staff": { "id": "uuid", "name": "..." }
  }
}
```

---

## GET /booking/:id — not found

**Method:** GET
**URL:** `http://localhost:3000/booking/00000000-0000-0000-0000-000000000000`

**Expected 404:**
```json
{
  "error": "Booking not found",
  "code": "BOOKING_NOT_FOUND"
}
```

---

## GET /booking/business/:business_id — all bookings

**Method:** GET
**URL:** `http://localhost:3000/booking/business/YOUR_BUSINESS_UUID`

**Expected 200:**
```json
{
  "bookings": [ ...array of booking objects... ]
}
```

---

## GET /booking/business/:business_id — with filters

**Method:** GET
**URL:** `http://localhost:3000/booking/business/YOUR_BUSINESS_UUID?status=confirmed&from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z&limit=10`

**Expected 200:** filtered bookings array

---

## PATCH /booking/:id/cancel — success

**Method:** PATCH
**URL:** `http://localhost:3000/booking/YOUR_BOOKING_UUID/cancel`

**Expected 200:**
```json
{
  "booking": {
    "id": "uuid",
    "status": "cancelled",
    ...
  }
}
```

---

## PATCH /booking/:id/cancel — already cancelled

**Method:** PATCH
**URL:** `http://localhost:3000/booking/YOUR_BOOKING_UUID/cancel` (run twice)

**Expected 400:**
```json
{
  "error": "Booking is already cancelled",
  "code": "ALREADY_CANCELLED"
}
```

---

## GET /availability — success

**Method:** GET
**URL:** `http://localhost:3000/availability?business_id=YOUR_BUSINESS_UUID&staff_id=YOUR_STAFF_UUID&date=2026-05-01`

**Expected 200:**
```json
{
  "date": "2026-05-01",
  "slots": [
    "2026-05-01T09:00:00.000Z",
    "2026-05-01T09:30:00.000Z",
    "2026-05-01T10:00:00.000Z"
  ]
}
```

---

## GET /availability — missing params

**Method:** GET
**URL:** `http://localhost:3000/availability?business_id=YOUR_BUSINESS_UUID`

**Expected 400:**
```json
{
  "error": "Missing required fields: staff_id, date",
  "code": "MISSING_FIELDS"
}
```

---

## GET /availability — invalid date format

**Method:** GET
**URL:** `http://localhost:3000/availability?business_id=uuid&staff_id=uuid&date=01-05-2026`

**Expected 400:**
```json
{
  "error": "date must be in YYYY-MM-DD format",
  "code": "INVALID_DATE"
}
```

---

## GET /availability — no schedule for that day

If the staff member has no schedule row for that day of week:

**Expected 200:**
```json
{
  "date": "2026-05-01",
  "slots": []
}
```
