# Operis Backend — Context

## What Operis Is

Operis is the complete operating system for Thai service businesses. It combines an AI voice receptionist with automated client management, booking intelligence, and business growth tools — all accessible through a single phone number. Businesses get a dedicated number that answers calls in Thai and English, books appointments, handles reminders, recovers missed calls, and re-engages lapsing clients automatically.

The target market is solopreneur and small-team service businesses in Thailand (nail salons, massage, barbershops, clinics, fitness studios, tutoring centres), launching first in Nonthaburi and Bangkok, expanding to Vietnam in month 4 and Philippines in month 7.

---

## Product Tiers

### CORE — All plans
- AI receptionist (inbound calls, Thai + English)
- Client memory (recognise returning callers by phone number)
- Live booking completion during the call
- SMS confirmation after every booking
- 24h and 1h automated reminders
- Conflict detection (no double booking)
- Missed call recovery SMS within 60 seconds
- Basic analytics dashboard

### GROWTH — Business tier
- Client re-engagement outreach (auto SMS when client is overdue)
- No-show risk scoring per client
- Deposit collection for high-risk bookings
- Google review collection SMS
- Loyalty points system
- Staff schedule optimisation
- Full analytics with revenue insights

### RETENTION — Pro tier
- Seasonal campaign automation (Thai holidays — Songkran, New Year, etc.)
- Waitlist management
- Group booking management
- White-label AI persona per number
- Advanced client insights
- Priority voice quality

### FUTURE — Version 2+
- WhatsApp integration
- Outbound calling
- Multi-location support
- Voice notes for owners

---

## Pricing

| Plan | Price | Numbers | Minutes | SMS |
|---|---|---|---|---|
| Starter | ฿2,990/month | 1 | 250 | 400 |
| Business | ฿5,490/month | 3 | 700 | 1,000 |
| Pro | ฿9,990/month | 8 | 1,500 | 2,500 |

- All plans include a 14-day free trial (card required)
- Annual option saves 2 months

**Overage rates:**

| Plan | Per minute | Per SMS |
|---|---|---|
| Starter | ฿5.00 | ฿0.60 |
| Business | ฿4.50 | ฿0.55 |
| Pro | ฿4.00 | ฿0.50 |

---

## Billing Model

- Billed per number per month
- Usage (minutes, SMS) tracked in Supabase
- Overages calculated and charged monthly via Stripe
- Failed payment suspends the number automatically
- Stripe handles all subscription and payment logic
- **Current state:** billing handled manually via PromptPay — Stripe integration deferred

---

## Build Layers

| Layer | Name | Status |
|---|---|---|
| 1 | Database | DONE |
| 2 | Server + Railway | DONE |
| 3 | Booking + Availability | DONE |
| 4 | Call Routing | DONE |
| 5 | Twilio Service | PARTIAL |
| 6 | Stripe Billing | NOT BUILT |
| 7 | Provision Orchestrator | DONE |
| 8 | Multilingual Thai | DONE |
| 9 | Reminder System | DONE |
| 10 | Missed Call Recovery | DONE |
| 11 | Re-engagement Outreach | NOT BUILT |
| 12 | No-Show Protection + Deposits | NOT BUILT |
| 13 | Google Review Collection | NOT BUILT |
| 14 | Loyalty Points | NOT BUILT |
| 15 | Analytics Engine | NOT BUILT |
| 16 | Billing + Overage System | NOT BUILT |
| 17 | Seasonal Campaigns | NOT BUILT |
| 18 | Waitlist Management | NOT BUILT |
| 19 | Staff Optimisation | NOT BUILT |
| 20 | Dashboard Frontend | DONE |

---

## Full Stack

| Technology | Role |
|---|---|
| Node.js | Runtime |
| Express 5.x | HTTP server and routing |
| cors | Cross-origin request handling |
| dotenv | Environment variable loading |
| @supabase/supabase-js | Supabase client — persistent database |
| Railway | Hosting and deployment |
| Twilio | Inbound call reception and SMS |
| Vapi | AI voice agent — handles call conversation |
| Cartesia | Voice synthesis for Vapi (sonic-multilingual, Thai + English) |
| Stripe | Subscription billing and payments (deferred) |

---

## File Structure

```
operis-backend/
├── server.js                           # Express app — entry point, all routes
├── package.json                        # Dependencies and project metadata
├── package-lock.json                   # Lockfile
├── railway.json                        # Railway deployment config
├── .env                                # Local secrets — never committed
├── .env.example                        # Template for required environment variables
├── .gitignore                          # Excludes .env, node_modules, .DS_Store
├── CONTEXT.md                          # This file
├── PROGRESS.md                         # Build status and session log
├── login.html                          # Owner login page (Supabase Auth)
├── dashboard.html                      # Owner dashboard — scoped per business via auth
├── onboarding.html                     # 3-step owner onboarding wizard
├── provision.html                      # Internal tool — create business + AI receptionist
├── backend/
│   ├── config/
│   │   └── supabase.js                 # Supabase client (uses env vars)
│   ├── controllers/
│   │   ├── bookingController.js        # POST/GET/PATCH booking endpoints
│   │   ├── availabilityController.js   # GET availability slots
│   │   ├── callController.js           # POST /call/inbound, /call/vapi-callback
│   │   ├── onboardingController.js     # POST /onboarding/provision
│   │   ├── provisionController.js      # POST /provision — create business + provision agent
│   │   └── demoController.js           # GET /demo (HTML page), POST /demo/setup
│   ├── routes/
│   │   ├── booking.js
│   │   ├── availability.js
│   │   ├── call.js
│   │   ├── onboarding.js
│   │   ├── provision.js
│   │   └── demo.js
│   ├── services/
│   │   ├── provisionOrchestrator.js    # getVapiConfig, buildSystemPrompt, provisionBusiness
│   │   ├── smsService.js               # Twilio SMS wrapper — sendSms(to, body)
│   │   └── reminderService.js          # Hourly cron — processes pending reminders from DB
│   └── utils/
│       ├── errorHandler.js             # OperisError class + handleError
│       ├── validation.js               # requireFields, validatePhone, validateEmail, validateDatetime, validateFuture
│       └── vapiContext.js              # Builds flat context object passed to Vapi on inbound calls
└── docs/
    ├── booking.md
    ├── reschedule.md
    ├── availability.md
    ├── api.md
    ├── onboarding-flow.md
    ├── call-routing.md
    ├── data-model.md
    └── tests/
        ├── layer3.md
        └── layer4.md
```

---

## API Endpoints (Currently Implemented)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Root — returns `"Operis backend running"` |
| GET | `/health` | Health check — queries Supabase `businesses` table |
| POST | `/booking` | Create booking — validates, upserts client, inserts booking, queues reminders, SMS owner |
| GET | `/booking/:id` | Get booking with client/service/staff joins |
| GET | `/booking/business/:business_id` | List bookings with status/from/to/limit filters |
| PATCH | `/booking/:id/cancel` | Cancel booking. Enforces `cancellation_window_hours` for non-owner callers — flags for owner review if within window |
| PATCH | `/booking/:id/deposit-paid` | Owner-only. Flips a deposit_pending booking to confirmed, fires confirmed side-effects |
| GET | `/availability` | Generate available slots from staff schedules |
| POST | `/call/inbound` | Twilio webhook — looks up number, logs session, returns TwiML |
| POST | `/call/vapi-callback` | Vapi end-of-call webhook — updates call_session, sends missed call recovery SMS if no booking |
| POST | `/onboarding/provision` | Create Vapi agent + insert phone_numbers row + mark onboarding complete (requires existing business) |
| POST | `/provision` | Create business row + provision Vapi agent + phone_numbers row in one step (used by provision.html) |
| GET | `/demo` | Mobile HTML demo setup page |
| POST | `/demo/setup` | Patch shared demo Vapi agent with shop name + language |
| POST | `/webhooks/line` | LINE Official Account webhook — scaffold; logs payload, detects booking-intent keywords, replies with placeholder. See LINE_INTEGRATION.md |

---

## Architecture Decisions

- **No in-memory storage** — all data persisted to Supabase
- **Validate server-side** — all inputs validated before any DB write; never trust the client
- **No silent failures** — every error returns an explicit HTTP status and error code
- **No credentials in code** — all secrets via environment variables only
- **UTC timestamps** — all time fields stored in UTC
- **Client identification** — clients looked up by phone number on inbound calls
- **Conflict detection** — duplicate booking conflicts handled via Supabase exclusion constraint
- **Call routing** — inbound Twilio calls hit `/call/inbound`; backend looks up the number, builds context, returns TwiML redirect to Vapi
- **Provision rollback** — if Vapi agent is created but Supabase write fails, the agent is deleted before the error is thrown
- **PORT** — never hard-coded; Railway controls it via environment variable
- **Voice provider** — Cartesia sonic-multilingual for both Thai and English; no ElevenLabs dependency
- **SMS** — all outbound SMS via `smsService.js` (Twilio wrapper); fire-and-forget on all non-critical paths (owner notification, missed call recovery, reminders) — fails silently if Twilio credentials are not set
- **Reminder cron** — `reminderService.js` runs on server startup then every hour; queries `reminders` table for `pending` rows with `scheduled_at <= now`, sends SMS, marks `sent` or `failed`
- **Stale reminder guard** — at booking creation time, `reminder_24h` and `reminder_1h` rows are only inserted if their `scheduled_at` is in the future
- **Owner login** — Supabase Auth (email + password); `businesses.owner_user_id` links auth user to their business; all dashboard queries scoped via session
- **Onboarding detection** — dashboard checks for services + availability_windows; redirects to onboarding wizard if either is missing
- **Provision tool** — `POST /provision` creates business row + Vapi agent in one call; `provision.html` is an internal mobile tool for the founder
- **Operating hours dual-write** — onboarding wizard writes hours to BOTH `availability_windows` (for slot generation) AND `businesses.operating_hours` JSONB (for after-hours attribution). Single user action, two stores, derived from the same form
- **Thai public holidays** — hardcoded list in `backend/config/thaiHolidays.js`. AI prompt lists upcoming 90-day holidays; `bookingController.createBooking` blocks on holiday dates with a 409 `HOLIDAY_CLOSED` error. Update yearly
- **Cancellation window** — `businesses.cancellation_window_hours` (default 24). Owner UI cancels always succeed. AI/Vapi cancels within the window are refused with 409 `CANCEL_WINDOW_EXPIRED` and the booking is set `flagged_for_owner = true`. Confirmation SMS includes the policy text
- **Deposit-pending flow** — first-time caller + service price ≥ `businesses.deposit_threshold_thb` (default ฿1,500) + `businesses.promptpay_id` set → booking inserts as `deposit_pending`. PromptPay QR PNG generated via `backend/services/promptpayService.js` (EMVCo + CRC-16/CCITT-FALSE), uploaded to Supabase Storage bucket `promptpay-qr`, link sent in customer SMS. Owner marks paid via dashboard → `PATCH /booking/:id/deposit-paid` flips status to confirmed and fires regular side-effects
- **Intake questions** — owner configures up to 3 in `services.html`. AI asks them after slot confirmation, before `create_booking`. Stored on `bookings.intake_answers` JSONB. Surfaced inline on booking cards in dashboard
- **Owner notes per client** — reuses `clients.notes`. Owner sets/edits via the dashboard booking card. AI prompt includes `{{client_notes}}` placeholder; `/call/inbound` passes the note via Vapi `assistantOverrides.variableValues` so the AI personalises returning calls
- **LINE webhook** — `/webhooks/line` is a scaffold that signs payloads, detects booking-intent keywords, replies with a placeholder. Full booking flow not built — see `LINE_INTEGRATION.md`

---

## Environment Variables

| Variable | Purpose | Status |
|---|---|---|
| `PORT` | Server listen port | Railway sets automatically — do not set manually in production |
| `SUPABASE_URL` | Supabase project URL | Required — set in Railway |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Required — set in Railway |
| `SUPABASE_ANON_KEY` | Supabase anon key | Not used yet |
| `VAPI_API_KEY` | Vapi API key | Required — set in Railway |
| `CARTESIA_VOICE_TH` | Cartesia voice ID for Thai | Required for provisioning — not yet set |
| `CARTESIA_VOICE_EN` | Cartesia voice ID for English | Required for provisioning — not yet set |
| `DEMO_VAPI_AGENT_ID` | Pre-created Vapi agent ID for demo page | Required for demo — not yet set |
| `DEMO_TWILIO_NUMBER` | Twilio number shown on demo page | Required for demo — not yet set |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier | Required for SMS + call routing — not yet set in Railway |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Required for SMS + call routing — not yet set in Railway |
| `TWILIO_PHONE_NUMBER` | Twilio outbound SMS number | Required for SMS — not yet set in Railway |
| `STRIPE_SECRET_KEY` | Stripe secret key | Deferred — not yet set |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Deferred — not yet set |
| `STRIPE_PRICE_ID` | Stripe price ID | Deferred — not yet set |
| `FRONTEND_URL` | Frontend origin for CORS | Not yet set |
| `BASE_URL` | Public Railway URL | Required for Twilio webhooks — not yet set |
| `NODE_ENV` | Runtime environment | Set to `production` in Railway |

---

## Database Schema Additions (Phase 2)

| Table | Column | Purpose |
|---|---|---|
| `businesses` | `owner_user_id` (uuid, FK → auth.users, UNIQUE) | Links Supabase Auth user to their business |
| `businesses` | `operating_hours` (JSONB) | `{ mon: {open, close}, ... }`. Used by attribution + AI prompt |
| `businesses` | `average_booking_value` (NUMERIC) | THB fallback for booking value when service price unknown |
| `businesses` | `cancellation_window_hours` (INTEGER, default 24) | Hours before start_time during which AI cannot auto-cancel |
| `businesses` | `cancellation_policy_text` (TEXT) | Optional override for default policy text in SMS + prompt |
| `businesses` | `promptpay_id` (TEXT) | Phone or 13-digit national ID for QR generation |
| `businesses` | `deposit_threshold_thb` (INTEGER, default 1500) | Trigger value for first-time-caller deposit flow |
| `businesses` | `intake_questions` (JSONB, default `[]`) | Up to 3 owner-configured questions the AI asks before booking |
| `bookings` | `intake_answers` (JSONB, default `[]`) | `[{ question, answer }, ...]` recorded by the AI at booking time |
| `bookings` | `deposit_paid_at` (TIMESTAMPTZ) | Set when owner clicks "Mark deposit paid" |
| `bookings` | `flagged_for_owner` (BOOLEAN, default FALSE) | Set when AI tries to cancel within the window |
| `bookings` | `flag_reason` (TEXT) | Free-text reason explaining the flag |
| `call_sessions` | `was_after_hours`, `was_concurrent`, `outcome`, `booking_value`, `end_reason`, `recovery_sms_sent` | Attribution dashboard fields |
| `monthly_summaries` | (table) | Per-business per-month rollup of attribution metrics |

### RLS Policies Required

| Table | Policy | Status |
|---|---|---|
| `businesses` | SELECT where `owner_user_id = auth.uid()` | Required for login |
| `businesses` | UPDATE where `owner_user_id = auth.uid()` | Required for onboarding Step 1 |
| `services` | SELECT/INSERT scoped via businesses.owner_user_id | Required for onboarding Step 2 |
| `staff` | SELECT/INSERT scoped via businesses.owner_user_id | Required for onboarding Step 3 |
| `availability_windows` | INSERT scoped via businesses.owner_user_id | Required for onboarding Step 3 |
| `onboarding_state` | UPDATE/INSERT scoped via businesses.owner_user_id | Required for onboarding completion |

---

## Hard Constraints

1. Validate all inputs server-side before any DB write
2. No silent failures — always return an explicit error
3. No in-memory storage — nothing lives only in RAM
4. No credentials or secrets in source code — use environment variables
5. All timestamps in UTC
6. Do not use n8n for orchestration
7. Do not use Framer for any backend logic
8. Do not skip validation at any layer
9. Never hard-code PORT — Railway must control it
