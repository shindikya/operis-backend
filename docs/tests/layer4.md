# Layer 4 — Thunder Client Test Requests

Base URL: `http://localhost:3000`

---

## POST /call/inbound — simulates a Twilio webhook

**Method:** POST
**URL:** `http://localhost:3000/call/inbound`
**Headers:** `Content-Type: application/x-www-form-urlencoded`

**Body (form-encoded):**
```
To=%2B15551234567&From=%2B14155550123&CallSid=CA1234567890abcdef
```

| Field | Value | Notes |
|---|---|---|
| `To` | Your business's Twilio number (URL-encoded) | Must match `twilio_number` on a `businesses` row |
| `From` | A caller phone number | Used to look up client |
| `CallSid` | Any string | Twilio's call identifier |

**Expected response — known business, Vapi agent configured:**
```xml
<Response><Redirect>https://your-vapi-twilio-webhook-url</Redirect></Response>
```
Content-Type will be `text/xml`.

**Expected response — business not found for `To` number:**
```xml
<Response><Hangup/></Response>
```

**Expected response — business found but `vapi_agent_id` is null:**
```xml
<Response><Hangup/></Response>
```

**What to verify in Supabase after a successful call:**
- New row in `call_sessions` with `caller_number`, `business_id`, `context_snapshot`
- If caller was a known client: `client_id` is populated
- If caller was unknown: `client_id` is null
- `vapi_call_id` populated if Vapi API call succeeded

---

## POST /call/inbound — unknown caller (not in clients table)

Same request but use a `From` number that has no matching `clients` row.

**Expected:** Still returns Redirect TwiML (unknown callers are not rejected).
**Supabase:** `call_sessions` row has `client_id = null`, `context_snapshot.is_known_client = "false"`.

---

## POST /call/inbound — missing To/From

**Body:** `CallSid=CA123` (no To or From)

**Expected 400:**
```xml
<Response><Hangup/></Response>
```

---

## POST /call/vapi-callback — end of call report

**Method:** POST
**URL:** `http://localhost:3000/call/vapi-callback`
**Headers:** `Content-Type: application/json`

**Body:**
```json
{
  "message": {
    "type": "end-of-call-report",
    "call": {
      "id": "YOUR_VAPI_CALL_ID",
      "endedReason": "customer-ended-call",
      "duration": 142,
      "recordingUrl": "https://storage.vapi.ai/recordings/example.mp3",
      "endedAt": "2026-04-01T15:30:00.000Z"
    }
  }
}
```

Replace `YOUR_VAPI_CALL_ID` with a `vapi_call_id` value from a `call_sessions` row.

**Expected 200:**
```json
{ "received": true }
```

**What to verify in Supabase:**
- `call_sessions` row where `vapi_call_id` matches is updated with:
  - `outcome: "customer-ended-call"`
  - `duration_sec: 142`
  - `recording_url: "https://..."`
  - `ended_at: "2026-04-01T15:30:00.000Z"`

---

## POST /call/vapi-callback — other message type (status update)

**Body:**
```json
{
  "message": {
    "type": "status-update",
    "status": "in-progress"
  }
}
```

**Expected 200:**
```json
{ "received": true }
```
No DB write should occur for unhandled message types.

---

## POST /call/vapi-callback — missing message field

**Body:**
```json
{}
```

**Expected 400:**
```json
{
  "error": "Missing message",
  "code": "MISSING_PAYLOAD"
}
```

---

## POST /call/vapi-callback — missing call.id in end-of-call-report

**Body:**
```json
{
  "message": {
    "type": "end-of-call-report",
    "call": {
      "endedReason": "customer-ended-call"
    }
  }
}
```

**Expected 400:**
```json
{
  "error": "Missing call.id",
  "code": "MISSING_CALL_ID"
}
```

---

## Environment variables required for Layer 4

Add these to your `.env` before testing:

```
VAPI_API_KEY=your-vapi-api-key
VAPI_TWILIO_WEBHOOK_URL=https://api.vapi.ai/twilio/YOUR_PHONE_NUMBER_ID
```

`VAPI_TWILIO_WEBHOOK_URL` — find this in your Vapi dashboard under **Phone Numbers → your number → Twilio Webhook URL**.
