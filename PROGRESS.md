# Operis Backend — Progress

## Current Status

Layers 1–4 complete and tested. Layer 7 (Provision Orchestrator) built with multilingual Thai support. Layer 8 (Multilingual Thai) built — Vapi config, Thai system prompt, demo page. Deployed to Railway. Layers 5, 6, 9–20 not yet built.

---

## What Is Actually Built and Working

- [x] Express server starts on PORT from env (Railway-compatible)
- [x] `GET /` returns root string
- [x] `GET /health` queries Supabase `businesses` table — returns `{ status, db }`
- [x] `cors` wired as middleware
- [x] `dotenv` loaded as first line of server.js
- [x] `@supabase/supabase-js` client in `backend/config/supabase.js`
- [x] `.env.example` and `.gitignore` created
- [x] `railway.json` created — Nixpacks builder, `npm start`, restart on failure
- [x] `backend/utils/errorHandler.js` — OperisError + handleError
- [x] `backend/utils/validation.js` — requireFields, validatePhone, validateEmail, validateDatetime, validateFuture
- [x] `POST /booking` — full validation, client upsert, duration resolution, end_time calc, DB insert, conflict 409, reminder queue
- [x] `GET /booking/:id` — returns booking with client/service/staff
- [x] `GET /booking/business/:business_id` — list with status/from/to/limit filters
- [x] `PATCH /booking/:id/cancel` — cancels booking and pending reminders
- [x] `GET /availability` — loads schedule, generates slots, removes conflicts and past times
- [x] `POST /call/inbound` — looks up phone_numbers → business → client, logs call_sessions, returns TwiML
- [x] `POST /call/vapi-callback` — updates call_sessions with outcome/duration/recording on end-of-call
- [x] `POST /onboarding/provision` — creates Vapi agent, inserts phone_numbers row, marks onboarding complete, rolls back on failure
- [x] `backend/services/provisionOrchestrator.js` — `getVapiConfig(business, language)` with Cartesia voice (Thai + English), `buildSystemPrompt(business, language)` with full Thai prompt
- [x] `GET /demo` — mobile HTML demo setup page (Thai/English toggle, dark theme, no dependencies)
- [x] `POST /demo/setup` — patches shared DEMO_VAPI_AGENT_ID with shop name and language greeting

---

## Feature Checklist

### Infrastructure Layer
- [x] Load environment variables via dotenv in server.js
- [x] Wire cors middleware in server.js
- [x] Move PORT to environment variable
- [x] Connect Supabase client (`backend/config/supabase.js`)
- [x] Add .env.example
- [x] Add .gitignore
- [x] `GET /health` endpoint — verifies DB connection
- [x] `railway.json` — deployment config

### Booking Layer
- [x] `POST /booking` — full validation, upsert client, resolve duration, insert booking, 409 on conflict, queue reminder
- [x] `GET /booking/:id` — returns booking with client/service/staff
- [x] `GET /booking/business/:business_id` — list with filters
- [x] `PATCH /booking/:id/cancel` — cancels booking and pending reminders
- [ ] `PATCH /booking/:id` — reschedule (update time on existing booking)

### Availability Layer
- [x] `GET /availability` — slot generation from availability_windows, removes booked and past slots

### Call Routing Layer
- [x] `backend/utils/vapiContext.js` — builds context object (business info + client + last 5 bookings)
- [x] `POST /call/inbound` — looks up phone_numbers by called number, checks status, loads business + client, logs call_sessions, returns TwiML redirect to Vapi
- [x] `POST /call/vapi-callback` — receives end-of-call-report, updates call_sessions
- [ ] End-to-end test (requires live Twilio number + provisioned phone_numbers row with vapi_agent_id)

### Provision Orchestrator (Layer 7)
- [x] `POST /onboarding/provision` — accepts businessId + phoneNumber + language
- [x] Loads business from Supabase
- [x] Calls Vapi POST /assistant with full language config
- [x] Inserts phone_numbers row
- [x] Updates businesses.onboarding_complete
- [x] Updates onboarding_state.step_integrations + completed_at
- [x] Rollback: deletes Vapi agent if any Supabase write fails

### Multilingual Thai (Layer 8)
- [x] `getVapiConfig(business, language)` — Deepgram transcriber (nova-2, endpointing 400ms Thai / 300ms EN), gpt-4o-mini, Cartesia sonic-multilingual voice
- [x] Thai backchannel enabled
- [x] `buildSystemPrompt(business, language)` — full Thai prompt with rules, persona, fallback to owner contact
- [x] English prompt updated with same ruleset (2-sentence limit, no AI disclosure, warm endings)
- [x] Voice provider: Cartesia — `CARTESIA_VOICE_TH`, `CARTESIA_VOICE_EN`

### Demo Layer
- [x] `GET /demo` — mobile-optimised HTML page, no external deps
- [x] Thai/English language toggle
- [x] Calls `POST /demo/setup` — patches DEMO_VAPI_AGENT_ID on Vapi
- [x] Success state shows demo number + CALL NOW tel: link
- [x] Reset button

### Twilio Service (Layer 5)
- [ ] Not built

### Stripe Billing (Layer 6)
- [ ] Not built — billing handled manually via PromptPay for now

### Reminder System (Layer 9)
- [ ] Not built

### Missed Call Recovery (Layer 10)
- [ ] Not built

### Layers 11–20
- [ ] Not built

---

## What Is Missing or Broken

| Issue | Detail |
|---|---|
| Layer 4 not tested end-to-end | Needs a live Twilio number and a `phone_numbers` row with `vapi_agent_id` populated |
| No reschedule endpoint | `PATCH /booking/:id` not built |
| No Twilio service | Outbound SMS (confirmations, reminders) not wired to Twilio yet |
| No Stripe | Billing handled manually via PromptPay — Stripe integration deferred |
| No Vapi function-call handling | Vapi can't trigger bookings mid-call yet |
| No test runner | `npm test` exits with error |
| CARTESIA_VOICE_TH / EN not set | Need Cartesia voice IDs added to Railway |
| DEMO_VAPI_AGENT_ID not set | Need a pre-created Vapi agent ID added to Railway |
| DEMO_TWILIO_NUMBER not set | Need demo Twilio number added to Railway |

---

## Environment Variables

| Variable | Required | Status |
|---|---|---|
| `PORT` | No (Railway sets it) | Do not set manually |
| `SUPABASE_URL` | Yes | Set |
| `SUPABASE_SERVICE_KEY` | Yes | Set |
| `SUPABASE_ANON_KEY` | Not yet used | Set |
| `VAPI_API_KEY` | Yes | Set |
| `NODE_ENV` | No | Set (production) |
| `CARTESIA_VOICE_TH` | Yes (for Thai voice) | Not set |
| `CARTESIA_VOICE_EN` | Yes (for English voice) | Not set |
| `DEMO_VAPI_AGENT_ID` | Yes (for demo page) | Not set |
| `DEMO_TWILIO_NUMBER` | Yes (for demo page) | Not set |
| `TWILIO_ACCOUNT_SID` | Yes (for call routing) | Not set |
| `TWILIO_AUTH_TOKEN` | Yes (for call routing) | Not set |
| `TWILIO_PHONE_NUMBER` | Yes (for call routing) | Not set |
| `STRIPE_SECRET_KEY` | Deferred | Not set |
| `STRIPE_WEBHOOK_SECRET` | Deferred | Not set |
| `STRIPE_PRICE_ID` | Deferred | Not set |
| `FRONTEND_URL` | Yes (for CORS) | Not set |
| `BASE_URL` | Yes (for Twilio webhooks) | Not set |

---

## Session Log

### Session 1 — 2026-03-31

**Goal:** Read entire codebase and produce foundational documentation.

**Completed:**
- Read all existing files: server.js, package.json, CONTEXT.md (was empty), docs/booking.md, docs/reschedule.md (empty), docs/availability.md (empty)
- Rewrote CONTEXT.md with full system description, stack, file structure, endpoints, constraints
- Created PROGRESS.md (this file)
- Created docs/api.md with full endpoint docs and placeholders
- Created docs/onboarding-flow.md as placeholder skeleton
- Created docs/call-routing.md as placeholder skeleton
- Created docs/data-model.md as placeholder skeleton

**No code was changed.**

---

### Session 2 — 2026-03-31

**Goal:** Wire infrastructure layer — Supabase, dotenv, cors, health endpoint.

**Completed:**
- Created `backend/config/supabase.js` — Supabase client using env vars
- Rewrote `server.js` — dotenv first, cors wired, PORT from env, added `GET /health`
- Created `.env.example` with all 14 variables
- Created `.gitignore`
- Updated CONTEXT.md and PROGRESS.md to reflect new state

**No database tables created yet — those must be created in Supabase dashboard.**

---

### Session 3 — 2026-03-31

**Goal:** Build Layer 3 — core booking flow, availability, utils.

**Completed:**
- Created `backend/utils/errorHandler.js` — OperisError class, handleError function
- Created `backend/utils/validation.js` — requireFields, validatePhone, validateEmail, validateDatetime, validateFuture
- Created `backend/controllers/bookingController.js` — createBooking, getBooking, listBookings, cancelBooking
- Created `backend/controllers/availabilityController.js` — getAvailability
- Created `backend/routes/booking.js` and `backend/routes/availability.js`
- Updated `server.js` — removed old booking stub, mounted new route files
- Created `docs/tests/layer3.md` — Thunder Client test requests for all endpoints

**Database tables still need to be created in Supabase before endpoints work end-to-end.**

---

### Session 4 — 2026-04-01

**Goal:** Fix Layer 3 bugs found during testing, complete and verify.

**Completed:**
- Rewrote `bookingController.js` and `availabilityController.js` against real 14-table schema (was using guessed column names)
- Rewrote `docs/data-model.md` with all 14 real tables and every column
- Fixed `reminders` insert: removed non-existent `client_id`, added `business_id`, renamed `scheduled_for` → `scheduled_at`
- Fixed `cancelBooking`: removed `updated_at` (column doesn't exist on `bookings`)
- Fixed `availabilityController`: table is `availability_windows` not `staff_schedules`; added override_date/is_blocked logic
- Fixed `source` default: `'web'` → `'ui'` to satisfy `bookings_source_check` constraint
- Fixed RPC param: `p_client_id` → `client_id_input`
- Made `increment_client_sessions` a soft failure — logs error, never blocks booking response
- Removed temporary debug logging from `createBooking`

**Layer 3 tested and working end-to-end.**

---

### Session 5 — 2026-04-01

**Goal:** Build Layer 4 — Twilio to Vapi call handoff.

**Completed:**
- Created `backend/utils/vapiContext.js` — builds flat context object for Vapi variableValues
- Created `backend/controllers/callController.js` — handleInbound, handleVapiCallback
- Created `backend/routes/call.js` — POST /call/inbound (urlencoded), POST /call/vapi-callback
- Updated `server.js` — mounted /call routes
- Created `docs/tests/layer4.md` — Thunder Client test requests

---

### Session 6 — 2026-04-01

**Goal:** Correct and finalise Layer 4 call routing architecture.

**Completed:**
- Corrected `callController.js`: removed Vapi REST API call, removed VAPI_TWILIO_WEBHOOK_URL env dependency
- Changed lookup from `businesses.twilio_number` → `phone_numbers.number` (correct architecture)
- Added `phone_numbers.status` check: 'not in service' and 'temporarily unavailable' TwiML responses
- `vapi_agent_id` now sourced from `phone_numbers` table, not `businesses`
- Rewrote `vapiContext.js`: simplified to `{ business, client, lastBookings }` — last 5 bookings, no upcoming/recent split

**Layer 4 code complete. Not yet tested end-to-end — requires provisioned phone_numbers row.**

---

### Session 7 — 2026-04-07

**Goal:** Build Layer 7 (Provision Orchestrator) and Layer 8 (Multilingual Thai). Deploy to Railway.

**Completed:**
- Created `backend/services/provisionOrchestrator.js` — provisionBusiness, getVapiConfig, buildSystemPrompt
- Created `backend/controllers/onboardingController.js` — POST /onboarding/provision
- Created `backend/routes/onboarding.js`
- Created `railway.json` — Nixpacks, npm start, restart on failure
- Added `"start": "node server.js"` to package.json scripts
- Built `getVapiConfig(business, language)`:
  - Deepgram nova-2 transcriber (400ms endpointing Thai, 300ms English)
  - gpt-4o-mini, temperature 0.7, maxTokens 250
  - Cartesia sonic-multilingual voice (CARTESIA_VOICE_TH / CARTESIA_VOICE_EN)
  - Thai backchannel enabled
- Built `buildSystemPrompt(business, language)`:
  - Thai: full Thai-language prompt with persona, role, rules (2 sentences, polite endings, no AI disclosure)
  - English: same ruleset, English prose
- Created `backend/controllers/demoController.js` — demoPage (GET /demo), setupDemo (POST /demo/setup)
- Created `backend/routes/demo.js`
- Mounted `/onboarding` and `/demo` routes in server.js
- Updated `.env.example` with CARTESIA_VOICE_TH, CARTESIA_VOICE_EN, DEMO_VAPI_AGENT_ID, DEMO_TWILIO_NUMBER
- Updated CONTEXT.md with full product overview, all 20 layers, pricing, billing model

**Billing note:** Stripe deferred — payment handled manually via PromptPay for now.

---

### Session 8 — 2026-04-07

**Goal:** Sync CONTEXT.md and PROGRESS.md with actual codebase state.

**Completed:**
- Read all backend files — discovered demoController.js, demoRoutes, provisionOrchestrator.js, onboardingController.js not reflected in docs
- Updated CONTEXT.md: added Cartesia to stack, added demo routes to file structure and endpoints table, corrected architecture decisions (phone_numbers routing, TwiML redirect, demo mode, source constraint, soft-fail RPC), added new env vars (CARTESIA_VOICE_TH/EN, DEMO_VAPI_AGENT_ID, DEMO_TWILIO_NUMBER), updated env var status table
- PROGRESS.md: confirmed already up to date from Session 7

**No code was changed.**

---

## Session Start Prompt

Copy this at the start of every new session:

> Read CONTEXT.md and PROGRESS.md. Tell me what is currently built, what is missing, and confirm what we are building in this session. Do not write any code until I confirm.
