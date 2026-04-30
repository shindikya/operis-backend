# Operis Backend — Progress

## Current Status

Layers 1–4, 7, 8, 9, 10, 20 complete. Layer 5 (Twilio) partial — smsService.js built and wired, credentials not yet added to Railway. Backend fully deployed on Railway. Phase 3 complete — operating hours JSONB derivation, Thai public holidays, cancellation policy enforcement, services dashboard CRUD, PromptPay deposit flow, intake questions, owner notes per client, LINE webhook scaffold. Frontend pages: login.html, dashboard.html, onboarding.html, provision.html, services.html. Migrations: `migrations/20260430140000_phase3_features.sql` adds the new columns; pre-existing `20260429120000_revenue_attribution.sql` adds `operating_hours` + attribution columns. Both must be applied in Supabase before the new flows work.

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
- [x] `POST /call/vapi-callback` — updates call_sessions with outcome/duration/recording; sends missed call recovery SMS if no booking created
- [x] `POST /onboarding/provision` — creates Vapi agent, inserts phone_numbers row, marks onboarding complete, rolls back on failure
- [x] `backend/services/provisionOrchestrator.js` — `getVapiConfig(business, language)` with Cartesia voice (Thai + English), `buildSystemPrompt(business, language)` with full Thai prompt
- [x] `GET /demo` — mobile HTML demo setup page (Thai/English toggle, dark theme, no dependencies)
- [x] `POST /demo/setup` — patches shared DEMO_VAPI_AGENT_ID with shop name and language greeting
- [x] `backend/services/smsService.js` — Twilio SMS wrapper; throws if credentials missing (all callers handle as soft failure)
- [x] `backend/services/reminderService.js` — hourly cron; queries pending reminders, sends Thai SMS, marks sent/failed
- [x] `POST /booking` sends owner SMS on booking creation (fire-and-forget)
- [x] `POST /booking` inserts confirmation + 24h + 1h reminder rows; skips 24h/1h if already in the past
- [x] `POST /call/vapi-callback` fixed session lookup bug (was matching on vapi_call_id never set at insert time — now matches by caller_number + ended_at IS NULL)
- [x] `twilio@^5.13.1` installed
- [x] `login.html` — owner login via Supabase Auth (email + password)
- [x] `dashboard.html` — scoped per business via auth session, dynamic shop name, logout button
- [x] `dashboard.html` — redirects to login if no session, redirects to onboarding if services or hours missing
- [x] `onboarding.html` — 3-step wizard: shop name → services → opening hours
- [x] Onboarding: duplicate service name prevention, Step 3 recovery, onboarding_state upsert
- [x] `provision.html` — internal mobile tool (black/white/orange theme) to create business + AI receptionist
- [x] `POST /provision` endpoint — creates business row + calls provisionBusiness() in one step
- [x] `provisionOrchestrator.js` — fixed Vapi tool config (server moved outside function), voiceId fallback to prevent undefined
- [x] Phase 3 — operating hours dual-write (onboarding writes to `availability_windows` AND `businesses.operating_hours` JSONB)
- [x] Phase 3 — `backend/config/thaiHolidays.js` with 2026 calendar, `lookupHoliday`, `bangkokDateStr`, `upcomingHolidaysPromptBlock`
- [x] Phase 3 — AI prompt includes upcoming Thai holidays (next 90d), `bookingController.createBooking` blocks on holiday dates
- [x] Phase 3 — `businesses.cancellation_window_hours` + `cancellation_policy_text` enforced in `cancelBooking`; AI prompt includes the policy; reminder confirmation SMS appends the policy text
- [x] Phase 3 — `services.html` standalone CRUD page (active toggle, edit prompt, delete confirm, dup-name guard); link added to dashboard header
- [x] Phase 3 — `backend/services/promptpayService.js` — EMVCo + CRC-16/CCITT-FALSE payload, `qrcode` PNG, Supabase Storage upload to `promptpay-qr` bucket, returns public URL
- [x] Phase 3 — `bookingController.createBooking` flags first-time + price ≥ threshold + promptpay_id-set bookings as `deposit_pending`, sends customer + owner SMS with QR link
- [x] Phase 3 — `PATCH /booking/:id/deposit-paid` (owner-only) flips status, fires confirmed side-effects; dashboard card shows "Mark deposit paid" button
- [x] Phase 3 — `businesses.intake_questions` JSONB; AI prompt block instructs the agent; `create_booking` Vapi tool accepts `intake_answers` array; persisted to `bookings.intake_answers`; surfaced inline on dashboard cards; configurable in `services.html`
- [x] Phase 3 — Owner notes per client reuse `clients.notes`; AI prompt includes `{{client_notes}}` placeholder; `/call/inbound` passes context via `assistantOverrides` (base64 query); dashboard inline edit on each booking card
- [x] Phase 3 — `POST /webhooks/line` scaffold: HMAC-SHA256 signature verification, booking-intent keyword detection (Thai + English), placeholder reply via LINE reply API; `LINE_INTEGRATION.md` documents what's needed for full functionality

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
- [x] `backend/services/smsService.js` — `sendSms(to, body)` Twilio wrapper
- [x] Wired into bookingController (owner SMS) and callController (missed call recovery) and reminderService
- [ ] Twilio credentials not yet added to Railway — SMS inactive until set

### Stripe Billing (Layer 6)
- [ ] Not built — billing handled manually via PromptPay for now

### Reminder System (Layer 9)
- [x] `backend/services/reminderService.js` — hourly cron via setInterval
- [x] Processes `pending` reminders with `scheduled_at <= now` from Supabase
- [x] Sends Thai SMS per type: confirmation, reminder_24h, reminder_1h
- [x] Marks each reminder `sent` or `failed` after attempt
- [x] Stale reminder guard — 24h and 1h rows skipped at insert time if already past
- [x] Cron starts on server boot via `startReminderCron()` in server.js

### Missed Call Recovery (Layer 10)
- [x] Fires in `handleVapiCallback` when end-of-call-report received
- [x] Checks if a booking was created for this caller since call started
- [x] If no booking: sends Thai SMS to caller with business callback number
- [x] Fire-and-forget — never blocks callback response

### Dashboard Frontend (Layer 20)
- [x] `login.html` — Supabase Auth login, auto-redirect if session exists
- [x] `dashboard.html` — auth-guarded, fetches business by owner_user_id, dynamic shop name, logout
- [x] `dashboard.html` — onboarding redirect if services or availability_windows count is zero
- [x] `onboarding.html` — Step 1: confirm/edit shop name, updates businesses table
- [x] `onboarding.html` — Step 2: add services (name/duration/price), duplicate name check, batch insert to services table
- [x] `onboarding.html` — Step 3: 7-day hours grid with toggles, auto-creates staff row (solopreneur), inserts availability_windows
- [x] `onboarding.html` — Step 3 recovery: resumes at Step 3 if services exist but hours don't
- [x] `onboarding.html` — onboarding_state upsert (handles missing row)
- [x] `provision.html` — internal founder tool, black/white/orange theme, creates business + Vapi agent
- [x] `POST /provision` — provisionController.js + provision.js route, creates business row then calls provisionBusiness()
- [ ] RLS policies not yet applied in Supabase — auth/onboarding won't work until run
- [ ] `businesses.owner_user_id` column not yet added — required for login

### Layers 11–19
- [ ] Not built

---

## What Is Missing or Broken

| Issue | Detail |
|---|---|
| Twilio credentials not in Railway | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — all SMS inactive until set |
| Layer 4 not tested end-to-end | Needs a live Twilio number and a `phone_numbers` row with `vapi_agent_id` populated |
| No reschedule endpoint | `PATCH /booking/:id` not built |
| No Stripe | Billing handled manually via PromptPay — Stripe integration deferred |
| No test runner | `npm test` exits with error |
| CARTESIA_VOICE_TH / EN not set | Need Cartesia voice IDs added to Railway |
| DEMO_VAPI_AGENT_ID not set | Need a pre-created Vapi agent ID added to Railway |
| DEMO_TWILIO_NUMBER not set | Need demo Twilio number added to Railway |
| RLS policies not applied | Auth, onboarding, and dashboard won't work until RLS policies are run in Supabase |
| `businesses.owner_user_id` not added | Column + unique constraint needed in Supabase for login system |
| `onboarding_state.business_id` unique constraint | Needed for upsert in onboarding Step 3 |
| Phase 3 migration not applied | `migrations/20260430140000_phase3_features.sql` must be run in Supabase |
| Supabase Storage `promptpay-qr` bucket | Must be created (public read) for QR links to resolve |
| Vapi `assistantOverrides` query format unverified | The base64-encoded `assistantOverrides` query param in `/call/inbound` follows the documented Vapi pattern but has not been live-tested. If Vapi rejects it, fall back to per-call assistant updates via REST or use Vapi's transient assistant API |
| LINE phase 2 not built | Webhook accepts and replies but does not link to businesses, doesn't run the full booking flow. See LINE_INTEGRATION.md |

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
| `TWILIO_ACCOUNT_SID` | Yes (for SMS + call routing) | Not set — add to Railway |
| `TWILIO_AUTH_TOKEN` | Yes (for SMS + call routing) | Not set — add to Railway |
| `TWILIO_PHONE_NUMBER` | Yes (for outbound SMS) | Not set — add to Railway |
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

### Session 9 — 2026-04-08

**Goal:** Build Layer 5 (Twilio SMS), Layer 9 (Reminder System), Layer 10 (Missed Call Recovery).

**Completed:**
- Created `backend/services/smsService.js` — thin Twilio wrapper, throws if credentials missing
- Installed `twilio@^5.13.1`
- Updated `bookingController.js`: always fetches business (name, phone, slot_duration_min); captures service name; sends owner SMS on booking creation; inserts confirmation + 24h + 1h reminders; skips 24h/1h if already past (stale reminder guard)
- Created `backend/services/reminderService.js` — hourly cron, queries pending reminders, sends Thai SMS per type, marks sent/failed
- Wired `startReminderCron()` into `server.js` — starts on boot
- Rewrote `handleVapiCallback` in `callController.js`: fixed session lookup bug (now matches by caller_number + ended_at IS NULL instead of vapi_call_id); added missed call recovery — checks for booking since call started, sends Thai SMS to caller if none found
- Updated CONTEXT.md and PROGRESS.md

**Pending:** Twilio credentials to be added to Railway before SMS activates. Full end-to-end test after credentials set.

---

### Session 8 — 2026-04-07

**Goal:** Sync CONTEXT.md and PROGRESS.md with actual codebase state.

**Completed:**
- Read all backend files — discovered demoController.js, demoRoutes, provisionOrchestrator.js, onboardingController.js not reflected in docs
- Updated CONTEXT.md: added Cartesia to stack, added demo routes to file structure and endpoints table, corrected architecture decisions (phone_numbers routing, TwiML redirect, demo mode, source constraint, soft-fail RPC), added new env vars (CARTESIA_VOICE_TH/EN, DEMO_VAPI_AGENT_ID, DEMO_TWILIO_NUMBER), updated env var status table
- PROGRESS.md: confirmed already up to date from Session 7

**No code was changed.**

---

### Session 10 — 2026-04-09

**Goal:** Phase 2 — Login system, scoped dashboard, onboarding wizard.

**Completed:**
- Created `login.html` — Supabase Auth login (email + password), auto-redirect if session exists, localised error messages
- Updated `dashboard.html` — removed hardcoded BUSINESS_ID and "Test Barbershop"; fetches business by `owner_user_id` from session; added logout button; redirects to login.html if no session
- Created `onboarding.html` — 3-step wizard (shop name → services → hours); same dark green/gold theme
- Updated `dashboard.html` — redirects to onboarding.html if services or availability_windows count is zero
- Fixed 3 edge cases in onboarding: duplicate service name prevention (case-insensitive), Step 3 recovery (resumes at hours if services exist but hours don't), onboarding_state upsert for missing rows

**Requires Supabase setup:** `businesses.owner_user_id` column, RLS policies on businesses/services/staff/availability_windows/onboarding_state, auth user creation + linking.

---

### Session 11 — 2026-04-10

**Goal:** Build provision.html and POST /provision endpoint.

**Completed:**
- Created `provision.html` — mobile-first internal tool, black/white/orange theme, form with business name + phone + language toggle, loading state, success state with phone display + Copy + Call Now buttons
- Created `backend/controllers/provisionController.js` — validates input, creates business row in Supabase, calls provisionBusiness() with ownerPhone as phone number (TODO: replace with Twilio number pool)
- Created `backend/routes/provision.js` — POST / route
- Updated `server.js` — imported and mounted /provision routes
- Fixed `provisionOrchestrator.js` — moved `server` property from inside `function` to tool top level (Vapi validation error); added voiceId fallback strings so it's never undefined

---

### Session 12 — 2026-04-18

**Goal:** Update CONTEXT.md and PROGRESS.md with all Phase 2 work.

**Completed:**
- Updated CONTEXT.md: file structure (added login.html, dashboard.html, onboarding.html, provision.html, provisionController.js, provision.js route), endpoints table (added POST /provision), architecture decisions (owner login, onboarding detection, provision tool), Layer 20 status → DONE, RLS policies section
- Updated PROGRESS.md: current status, built list, feature checklist (added Layer 20 section), missing/broken table, session log (sessions 10, 11, 12)

**No code was changed.**

---

### Session 13 — 2026-04-30

**Goal:** Phase 3 — operating hours, holidays, cancellation policy, services dashboard, PromptPay deposits, intake questions, owner notes per client, LINE webhook scaffold.

**Completed:**
- `onboarding.html` — Step 3 now derives and dual-writes `businesses.operating_hours` JSONB alongside `availability_windows`
- `backend/config/thaiHolidays.js` — 2026 calendar + helpers (`lookupHoliday`, `bangkokDateStr`, `upcomingHolidaysPromptBlock`)
- AI prompt (Thai + English) — adds upcoming holidays block, cancellation policy block, intake-questions block, and `{{client_notes}}` per-call placeholder
- `bookingController.createBooking` — blocks holiday dates with 409 `HOLIDAY_CLOSED`; reads `intake_answers`; persists; flags first-time + price ≥ threshold + promptpay_id-set as `deposit_pending`; generates QR + sends customer/owner SMS with QR link
- `bookingController.cancelBooking` — enforces cancellation window for non-owner cancels; flags booking instead with 409 `CANCEL_WINDOW_EXPIRED`
- `bookingController.markDepositPaid` — new owner-only endpoint, flips deposit_pending → confirmed, fires confirmed side-effects
- `routes/booking.js` — `cancel` now accepts AI auth; `deposit-paid` route added
- `reminderService.js` — confirmation SMS now appends cancellation policy text
- `services.html` — new owner CRUD page (services + intake questions config); link added to dashboard header
- `dashboard.html` — surfaces deposit_pending status with "Mark deposit paid" button; shows intake answers inline; per-client owner-note edit on each card
- `backend/services/promptpayService.js` — EMVCo payload builder + CRC-16/CCITT-FALSE + qrcode PNG render + Supabase Storage upload
- `backend/controllers/lineController.js` + `routes/line.js` — LINE webhook scaffold with HMAC signature verification, booking-intent keyword detection, placeholder reply
- `LINE_INTEGRATION.md` — documents what's needed for full LINE booking
- `migrations/20260430140000_phase3_features.sql` — adds 9 new columns + 1 index + loosens bookings_status_check
- `package.json` — adds `qrcode` dependency

**Requires Supabase setup:** apply Phase 3 migration, create `promptpay-qr` Storage bucket (public read), apply RLS policies for the new columns.

**Pending verification:** Vapi `assistantOverrides` query-string format used in `/call/inbound` is the documented pattern but unverified live — if Vapi rejects it, switch to per-call REST API.

---

## Session Start Prompt

Copy this at the start of every new session:

> Read CONTEXT.md and PROGRESS.md. Tell me what is currently built, what is missing, and confirm what we are building in this session. Do not write any code until I confirm.
