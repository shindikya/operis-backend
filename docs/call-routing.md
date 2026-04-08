# Call Routing

**Status: Not yet designed or implemented.**

This document is a placeholder. The call routing system has not been built. The sections below define what needs to be designed and what questions remain open.

---

## What Needs to Be Defined

1. **How does Twilio reach our backend?**
   - What webhook URL is configured in Twilio?
   - What HTTP method does Twilio use (POST)?
   - What does the Twilio payload look like?

2. **How do we identify the business?**
   - By the `To` number (the Twilio number called)?
   - What Supabase table maps Twilio numbers to businesses?

3. **How do we identify the client?**
   - By the `From` number (caller's phone number)?
   - Do we look them up in a `clients` table?
   - What happens if the caller is not in the system?

4. **How do we build context for Vapi?**
   - What information does Vapi need to handle the call?
   - Business name, client name, past bookings, open slots?

5. **How does the handoff to Vapi work?**
   - Does our backend redirect Twilio to Vapi?
   - Do we call the Vapi API to initiate a session?
   - How is the context passed to the Vapi assistant?

6. **What happens after the call?**
   - Does Vapi call us back with results (booking created, reschedule requested)?
   - What endpoint handles Vapi callbacks?

---

## Planned Flow (To Be Filled In)

### Step 1 — Twilio receives inbound call
- Twilio fires `POST /inbound-call`
- Payload includes: `To`, `From`, `CallSid`

### Step 2 — Look up business
- Query Supabase: find business where `twilio_number = To`
- If not found: [behavior not defined]

### Step 3 — Look up client
- Query Supabase: find client where `phone = From` AND `business_id = <business>`
- If not found: treat as new caller, or reject — [not defined]

### Step 4 — Build context
- Assemble: business name, client name, recent bookings, available slots
- Format: [not defined]

### Step 5 — Hand off to Vapi
- Call Vapi API with context
- Return Twilio response to keep call alive
- [Exact mechanism not defined]

### Step 6 — Vapi callback
- Vapi calls `POST /vapi-callback` (not yet defined or built)
- Backend processes result: creates booking, sends confirmation, etc.

---

## Dependencies

- `POST /inbound-call` endpoint (not yet built)
- Supabase `businesses` table with `twilio_number` column (not yet built)
- Supabase `clients` table with `phone` column (not yet built)
- Vapi API integration (not yet built)
- Twilio webhook configuration (not yet done)
