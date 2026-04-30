# LINE Integration

This is a **scaffold**. The webhook endpoint exists, signs payloads, detects booking-intent keywords, and replies with a placeholder message. To make LINE booking actually work end-to-end, complete the items below.

## What's built

- `POST /webhooks/line` — accepts LINE Messaging API events
- Raw body capture for signature verification (HMAC-SHA256, base64)
- Booking-intent keyword detection (Thai + English): `นัด`, `จอง`, `book`, `appointment`, `schedule`, etc.
- Templated reply: "LINE booking coming soon — please call to book for now."
- Console logging of every payload (so we can replay them when phase 2 lands)

## What needs to be built (phase 2)

### 1. Provision a LINE Official Account per business

Right now there's no link between a LINE OA and a business. Either:
- One shared LINE OA where each business has a dedicated rich-menu / entry point that tags messages with their `business_id`, OR
- Each business gets their own LINE OA with their own `LINE_CHANNEL_SECRET` + `LINE_CHANNEL_ACCESS_TOKEN`, stored in a new `line_channels` table keyed by `business_id`

Recommended: per-business LINE OA. Store credentials per business in Supabase. Webhook signature verification then needs to be done against the right secret based on the destination ID.

Add to `businesses` (or a dedicated `line_channels` table):
- `line_channel_id` text
- `line_channel_secret` text
- `line_channel_access_token` text (consider encrypting)

### 2. Resolve LINE userId → Operis client

The LINE webhook gives you `event.source.userId` — a stable but opaque identifier. To match it to a `clients` row:

- Add `clients.line_user_id` text column with a unique-per-business constraint
- First time a user messages: create or update the client row, store the LINE userId
- On subsequent messages: look up by `(business_id, line_user_id)`

### 3. Booking conversation flow

The current voice flow uses Vapi for natural conversation. For LINE, options:
- **Same Claude/GPT model, message-based:** call the LLM directly with the LINE message, stream replies back via the LINE Messaging API. State stored in `clients.line_conversation_state` JSONB or a dedicated `line_conversations` table.
- **Vapi text mode:** if Vapi adds a text-channel API, use the same assistant. Currently Vapi is voice-only.
- **Rule-based for v1:** ignore free-text, use LINE Rich Menu buttons + Quick Reply to drive a fixed booking flow. Lower quality but faster to ship.

For phase 2 we recommend rule-based with Quick Reply (date picker, service picker) — it gets a working LINE booking out the door in days, not weeks.

### 4. Hand off to the booking pipeline

Once the user has picked a service + time + given their name, call `POST /booking` from inside `lineController.js`. Use a new auth source (`req.auth_source = 'line'`) and pass the resolved `business_id` from the channel mapping. The existing booking pipeline handles everything else: validation, conflict detection, SMS confirmation, reminders.

### 5. SMS / LINE message confirmation

Currently `reminderService.js` sends SMS only. For LINE-originated bookings, the customer's preferred channel might be LINE. Update `reminders.channel` to support `'line'` and add a LINE push-message dispatcher in `reminderService.js`.

## Environment variables to add

| Variable | Purpose |
|---|---|
| `LINE_CHANNEL_SECRET` | HMAC secret for signature verification (per-OA in phase 2) |
| `LINE_CHANNEL_ACCESS_TOKEN` | Bot user token for the reply / push API |

## Webhook URL to give to LINE Developers Console

```
https://operis-backend-production-3533.up.railway.app/webhooks/line
```

LINE will call this on every inbound message. Set it under your LINE channel's **Messaging API** > **Webhook URL**, then **Verify** to confirm reachability. Toggle **Use webhook = on**.

## Testing the scaffold

```bash
# Without signature (works in dev when LINE_CHANNEL_SECRET is unset)
curl -X POST https://operis-backend-production-3533.up.railway.app/webhooks/line \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "type": "message",
      "replyToken": "test-token",
      "source": { "userId": "U123abc" },
      "message": { "type": "text", "text": "ขอจองพรุ่งนี้บ่ายสอง" }
    }]
  }'
```

Expected response: `{ "ok": true }`. Logs should show booking intent detected.
