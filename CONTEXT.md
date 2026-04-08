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
| 5 | Twilio Service | NOT BUILT |
| 6 | Stripe Billing | NOT BUILT |
| 7 | Provision Orchestrator | DONE |
| 8 | Multilingual Thai | DONE |
| 9 | Reminder System | NOT BUILT |
| 10 | Missed Call Recovery | NOT BUILT |
| 11 | Re-engagement Outreach | NOT BUILT |
| 12 | No-Show Protection + Deposits | NOT BUILT |
| 13 | Google Review Collection | NOT BUILT |
| 14 | Loyalty Points | NOT BUILT |
| 15 | Analytics Engine | NOT BUILT |
| 16 | Billing + Overage System | NOT BUILT |
| 17 | Seasonal Campaigns | NOT BUILT |
| 18 | Waitlist Management | NOT BUILT |
| 19 | Staff Optimisation | NOT BUILT |
| 20 | Dashboard Frontend | NOT BUILT |

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
├── backend/
│   ├── config/
│   │   └── supabase.js                 # Supabase client (uses env vars)
│   ├── controllers/
│   │   ├── bookingController.js        # POST/GET/PATCH booking endpoints
│   │   ├── availabilityController.js   # GET availability slots
│   │   ├── callController.js           # POST /call/inbound, /call/vapi-callback
│   │   ├── onboardingController.js     # POST /onboarding/provision
│   │   └── demoController.js           # GET /demo (HTML page), POST /demo/setup
│   ├── routes/
│   │   ├── booking.js
│   │   ├── availability.js
│   │   ├── call.js
│   │   ├── onboarding.js
│   │   └── demo.js
│   ├── services/
│   │   └── provisionOrchestrator.js    # getVapiConfig, buildSystemPrompt, provisionBusiness
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
| POST | `/booking` | Create booking — validates, upserts client, inserts booking, queues reminder |
| GET | `/booking/:id` | Get booking with client/service/staff joins |
| GET | `/booking/business/:business_id` | List bookings with status/from/to/limit filters |
| PATCH | `/booking/:id/cancel` | Cancel booking and pending reminders |
| GET | `/availability` | Generate available slots from staff schedules |
| POST | `/call/inbound` | Twilio webhook — looks up number, logs session, returns TwiML |
| POST | `/call/vapi-callback` | Vapi end-of-call webhook — updates call_session record |
| POST | `/onboarding/provision` | Create Vapi agent + insert phone_numbers row + mark onboarding complete |
| GET | `/demo` | Mobile HTML demo setup page |
| POST | `/demo/setup` | Patch shared demo Vapi agent with shop name + language |

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
| `TWILIO_ACCOUNT_SID` | Twilio account identifier | Required for call routing — not yet set |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Required for call routing — not yet set |
| `TWILIO_PHONE_NUMBER` | Twilio inbound number | Required for call routing — not yet set |
| `STRIPE_SECRET_KEY` | Stripe secret key | Deferred — not yet set |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Deferred — not yet set |
| `STRIPE_PRICE_ID` | Stripe price ID | Deferred — not yet set |
| `FRONTEND_URL` | Frontend origin for CORS | Not yet set |
| `BASE_URL` | Public Railway URL | Required for Twilio webhooks — not yet set |
| `NODE_ENV` | Runtime environment | Set to `production` in Railway |

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
