# Operis — Build Order

_Source-of-truth sequencing document — 2026-04-24_

This file maps the exact sequence of frontend and backend work needed to take Operis from its current state to demo-ready, then to first 10 paying customers, then to 50, then to the Growth-tier price-point. **Read this first at the start of every Claude Code session.**

It supersedes any task ordering implied in [CONTEXT.md](CONTEXT.md), [PROGRESS.md](PROGRESS.md), or [SECURITY_AUDIT_RESULTS.md](SECURITY_AUDIT_RESULTS.md). Where those documents disagree (and they do — see Section 0 below), this file is the tiebreaker.

---

## 0. Source-of-truth reconciliation

These conflicts surfaced while writing this doc. Flagging them here so future sessions don't re-litigate:

1. **Pricing.** [CONTEXT.md §Pricing](CONTEXT.md) lists ฿2,990 / ฿5,490 / ฿9,990. [STRATEGY.md §2](STRATEGY.md) replaces it with platform-fee + per-seat ($85 / $89 / $149+$69 / $499+$59 / $999+$49 / $49 wholesale). **Strategy wins.** All UI, billing, and copywriting in this build order target the strategy ladder. CONTEXT.md needs the follow-up edit listed in [STRATEGY.md §10 #1](STRATEGY.md).
2. **Login / onboarding state.** [PROGRESS.md](PROGRESS.md) marks Layer 20 (dashboard frontend) DONE and login/onboarding/dashboard pages built. The user's brief says login and onboarding are "in progress." Resolution: the *shells* exist (login.html, onboarding.html, dashboard.html, provision.html on disk); the *production-ready behaviour* (auth-token wiring, RLS-aware queries, full happy-path coverage) is partial per [SECURITY_AUDIT_RESULTS.md §8](SECURITY_AUDIT_RESULTS.md). Treat them as ~70% built — finishing them is the bulk of Phase 1's frontend effort, not a from-scratch task.
3. **Multi-seat positioning.** User brief puts multi-seat in Phase 4. [STRATEGY.md §8](STRATEGY.md) says % multi-seat at month 18 is THE metric that decides whether Operis is a $1M lifestyle business or a $20M+ outcome. Today it is 0%. **Conclusion:** multi-seat plumbing (schema + RLS + UI) is Phase 3, not Phase 4. Phase 4 keeps the *marketing* (Growth-tier feature pillars), but the *capability* must land before that.
4. **"Layer 20 DONE" in [CONTEXT.md](CONTEXT.md).** This is misleading. The dashboard renders one page (overview + recent bookings); a real owner UI needs bookings, clients, services, analytics, settings tabs. Treat "dashboard fully working" as Phase 2 net-new work.

---

## Phase 1 — Demo Ready

**Goal:** by end of this week, a prospect can visit the landing page, enter their business name in the interactive widget, see a personalised AI phone demo, sign up, complete onboarding, get a real phone number, call it, have the AI book an appointment, and receive an SMS confirmation.

**Phase 1 is split into three sub-blocks because the bottleneck is human-in-the-loop ops (key rotation, migration apply, env-var config) — not code. Code work that depends on those steps will sit blocked until 1A is done.**

### 1A — Unblock (founder ops, no code)

| # | Task | Layer | Effort | Blocks | Prompt |
|---|---|---|---|---|---|
| 1.1 | Rotate Supabase service-role key, Supabase anon key, and Vapi API key per [SECURITY_AUDIT_RESULTS.md §C1](SECURITY_AUDIT_RESULTS.md). Update Railway env vars with new values. | ops | 30 min | 1.2, all of Phase 1B | n/a (manual) |
| 1.2 | Apply all four migrations in Supabase: `20260429120000_revenue_attribution.sql`, `20260430110000_rls_policies.sql`, `20260430110001_bookings_two_phase.sql`, `20260430110002_failed_webhooks.sql`, plus `20260424120000_landing_page_demos.sql` (just added). | backend / migration | 30 min | 1.3, 1.5, 1.7, 2.x dashboard work | n/a (manual SQL) |
| 1.3 | Add `businesses.owner_user_id UUID UNIQUE REFERENCES auth.users(id)` column in Supabase. Required by `dashboard.html` and `onboarding.html` per [PROGRESS.md "Missing or Broken"](PROGRESS.md). | backend / migration | 15 min | 1.5, 1.6 | n/a (manual SQL) |
| 1.4 | Set every Phase-1 env var in Railway: `VAPI_WEBHOOK_SECRET` (`openssl rand -hex 32`, mirror to every Vapi assistant's server config), `BASE_URL`, `VAPI_TOOL_SECRET`, `ADMIN_TOKEN`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`, `CARTESIA_VOICE_TH/EN`, `DEMO_VAPI_AGENT_ID`, `DEMO_TWILIO_NUMBER`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`. | ops | 45 min | 1.7, 1.8, 1.9, 1.13 | n/a (manual) |

### 1B — Build (code work)

| # | Task | Layer | Effort | Blocks | Prompt |
|---|---|---|---|---|---|
| 1.5 | **Finish login.html** — confirm `Authorization: Bearer <jwt>` is sent on every backend call, surface RLS errors, signup flow (Supabase magic-link or password), session refresh on 401. | frontend | 0.5 day | 1.6 | new prompt needed |
| 1.6 | **Finish onboarding wizard** — current 3-step flow exists; add the in-progress widgets per the user's brief: operating-hours grid polish, Thai holidays toggle, cancellation policy, service menu UI, PromptPay QR upload, intake questions, owner voice-note recorder, LINE OA placeholder. Cross-check `businesses.owner_user_id` is set when wizard completes. | frontend + small backend | 2 days | 1.10 | per-feature prompts already in flight (parallel build session) |
| 1.7 | **Two-phase booking prompt update** — modify `provisionOrchestrator.js` system prompt + `create_booking` tool description; add a second `confirm_booking` tool definition; ship a maintenance script (`tools/reprovision-assistants.js`) that PATCHes every existing assistant. Per [SECURITY_AUDIT_RESULTS.md Outstanding Issue #1](SECURITY_AUDIT_RESULTS.md). | backend | 0.5 day | 1.13 (ghost-booking class is unmitigated until this ships) | new prompt needed |
| 1.8 | **Twilio number purchase API** — replace shared `TWILIO_PHONE_NUMBER` in `provisionController.js` with a programmatic Twilio AvailablePhoneNumbers + IncomingPhoneNumbers purchase, scoped to Thailand region; configure the new number's voice URL to `${BASE_URL}/call/inbound`. Per [SECURITY_AUDIT_RESULTS.md Outstanding Issue #4](SECURITY_AUDIT_RESULTS.md). **Without this, customer #2 breaks the unique constraint on `phone_numbers.number`.** | backend | 0.5 day | 1.13, 2.x onboarding-at-scale | new prompt needed |
| 1.9 | **Cartesia voice-ID per language** — `provisionOrchestrator.js:96` currently uses one hardcoded voice ID regardless of language. Split by `language` parameter so Thai assistants use `CARTESIA_VOICE_TH` and English use `CARTESIA_VOICE_EN`. Per [SECURITY_AUDIT_RESULTS.md Outstanding Issue #5](SECURITY_AUDIT_RESULTS.md). | backend | 1 hour | 1.13 | new prompt needed |
| 1.10 | **Landing page** — single `landing.html` matching the existing single-file pattern. All seven sections from the user's 2026-04-24 brief: live AI receptionist preview (animated phone mockup), build-your-receptionist widget (POSTs to `/api/landing/demo` capture endpoint already added), missed-revenue counter, live call-log feed, voice-waveform hero background, owner dashboard peek, plus the small techy details. Pricing copy must match [STRATEGY.md §2](STRATEGY.md), not CONTEXT.md. | frontend | 1.5 days | 1.13 | already written: the landing-page prompt sent 2026-04-24 |
| 1.11 | **Demo provisioning flow wiring** — interactive widget on landing.html submits to `/api/landing/demo` (capture only, no real Vapi call) AND offers a "call this real number now" CTA pointing at `/demo` which already PATCHes `DEMO_VAPI_AGENT_ID`. Confirm `/demo/setup` works with H3 (length cap, newline strip, prompt-injection sentinels) before exposing publicly. | both | 0.5 day | 1.13 | combine with 1.10's prompt |
| 1.12 | **H3 mitigation on `/demo/setup`** — implement the demo prompt-injection guards from [SECURITY_AUDIT_RESULTS.md §H3](SECURITY_AUDIT_RESULTS.md): 60-char cap, strip `[\n\r{}]`, regex-block "ignore previous", "system prompt", etc. Without this, the public landing page's interactive demo is a sales-blocking attack surface. | backend | 1 hour | 1.13 | new prompt needed (small) |

### 1C — Verify (end-to-end live test)

| # | Task | Layer | Effort | Blocks | Prompt |
|---|---|---|---|---|---|
| 1.13 | Run [SECURITY_AUDIT_RESULTS.md "How to perform the live tests"](SECURITY_AUDIT_RESULTS.md) Tests 1, 2, 3, 4, 5, 6, 7 against staging. The full prospect-to-booking funnel. Anything that fails goes back into 1B. | qa | 0.5 day | Phase 2 | n/a (manual) |

**Phase 1 total effort:** ~5–6 working days of code + ~2 hours of founder ops. Honest critical path within Phase 1: 1A (ops) → 1.7 / 1.8 (backend unblocks) → 1.10 (landing page) → 1.13 (verify). Onboarding-wizard polish (1.6) parallelizes with 1.10.

---

## Phase 2 — First 10 Paying Customers

**Goal:** revenue within 2 weeks. A prospect who just experienced the demo can sign up online, enter card details, get billed, and use the product. The dashboard is good enough that a paying customer will not refund-rage.

**Why these tasks belong here:** every one is a blocker for charging a real customer or for the customer's first 30 days of use.

| # | Task | Layer | Effort | Blocks | Prompt |
|---|---|---|---|---|---|
| 2.1 | **Stripe Billing — Layer 6.** Subscription products for each SKU per [STRATEGY.md §2](STRATEGY.md): Starter TH (THB 2,990 ≈ $85), Starter Intl ($89), Growth ($149 base + $69/seat), Scale, Enterprise (the latter two contract-style, not self-serve). 14-day free trial, card required at signup. Stripe webhook for `customer.subscription.updated/deleted` writes to `businesses.plan_tier` + `businesses.seats_allowed`. Failed-payment dunning suspends `phone_numbers.status='temporarily unavailable'` automatically. **The single largest gap in the business right now per [STRATEGY.md §9 Outcome 3](STRATEGY.md).** | backend + frontend | 5 days | 2.2, 2.3, 2.5, all of Phase 3 | new prompt needed |
| 2.2 | **Plan-tier enforcement schema + middleware** — add columns to `businesses`: `plan_tier`, `seats_allowed`, `minutes_used_this_period`, `sms_used_this_period`, `period_start`. Block over-quota usage at call-start in `handleInbound`. Per [SECURITY_AUDIT_RESULTS.md §M4](SECURITY_AUDIT_RESULTS.md) — this finding is "Critical the day Stripe goes live," which is the day after 2.1 ships. | backend | 1 day | 2.1's launch | new prompt needed |
| 2.3 | **Overage tracking + monthly invoice** — write `usage_events` rows on every Vapi call end-of-call-report (minutes, SMS, WhatsApp). Monthly cron rolls up + posts overage line items to Stripe Invoice. Rates per [STRATEGY.md §2 Overages](STRATEGY.md). | backend | 1.5 days | charging the 11th customer beyond plan minutes | new prompt needed |
| 2.4 | **Dashboard — bookings tab.** List view filterable by status/date, edit booking time (calls 2.x reschedule endpoint), cancel booking, view client history. Currently dashboard.html is a single overview page; this is net-new. | frontend | 1.5 days | customer keeping their schedule clean | new prompt needed |
| 2.5 | **Dashboard — clients tab.** Searchable list of `clients` rows scoped by RLS. Each client opens to last-N bookings, total revenue, last-contact date. Read-only first; PDPA-erasure UI is Phase 3. | frontend | 1 day | retention conversation customers ask for | new prompt needed |
| 2.6 | **Dashboard — services tab.** Edit `services` rows (name, duration, price). Already insertable in onboarding step 2; add the post-onboarding edit UI. | frontend | 0.5 day | customers updating their menu | new prompt needed |
| 2.7 | **Dashboard — analytics tab.** Already-built `/api/dashboard/:businessId/attribution` endpoint per [SECURITY_AUDIT_RESULTS.md](SECURITY_AUDIT_RESULTS.md) — surface its output: revenue captured, calls answered, after-hours bookings, recoveries. Plus the CSV export already wired. | frontend | 1 day | retention story for the first 30 days | new prompt needed |
| 2.8 | **Dashboard — settings tab.** Business name, owner phone, language, operating hours, billing portal link (Stripe customer portal), upgrade/downgrade plan. | frontend | 1 day | customer self-serve = lower support load | new prompt needed |
| 2.9 | **Reschedule endpoint** — `PATCH /booking/:id` per [PROGRESS.md "Missing or Broken"](PROGRESS.md). Validates new slot via the same race-safe path; reissues 24h/1h reminders. | backend | 0.5 day | 2.4 | new prompt needed |
| 2.10 | **CORS + body-size hardening (HIGH findings cleanup).** [SECURITY_AUDIT_RESULTS.md §H1](SECURITY_AUDIT_RESULTS.md) restrict CORS via `CORS_ALLOWED_ORIGINS`. §H4 generic DB error messages. Fast wins. | backend | 0.5 day | not strictly blocking but irresponsible to ship without | new prompt needed (small) |
| 2.11 | **Reminder cron interval drop to 5 min** — [SECURITY_AUDIT_RESULTS.md §M7](SECURITY_AUDIT_RESULTS.md). Currently the 1-hour reminder fires up to 59 minutes late, which a paying customer will notice. | backend | 30 min | customer complaint volume | new prompt needed (small) |
| 2.12 | **Live test with two real businesses** — onboard a second test business after 1.8 ships; confirm cross-tenant isolation per [SECURITY_AUDIT_RESULTS.md Test 2 + Test 3](SECURITY_AUDIT_RESULTS.md). | qa | 0.5 day | onboarding customer #2 | n/a (manual) |

**Phase 2 total effort:** ~14 working days. Honest critical path within Phase 2: 2.1 (Stripe) → 2.2 (plan tier) → 2.10/2.11 (HIGH cleanup) → 2.12 (live multi-tenant test). Dashboard tabs (2.4–2.8) parallelize with 2.1.

---

## Phase 3 — Scale to 50 Customers

**Goal:** the platform safely handles 50 concurrent paying customers, including PDPA, abuse-resistant infrastructure, the first multi-seat customer (per [STRATEGY.md §9 Outcome 1](STRATEGY.md)), and the operational features that reduce churn below the 4% blended target.

**Multi-seat appears here, not in Phase 4.** [STRATEGY.md §8](STRATEGY.md) is unambiguous: percent-multi-seat-at-M18 is the metric that decides whether Operis becomes a $1–2M lifestyle business or a $20M+ outcome. Today it's 0%. The first multi-seat deal is targeted by month 4 (Outcome 1, 90-day plan). Schema and UI must support that target — not be deferred to a later phase tied to feature marketing.

| # | Task | Layer | Effort | Blocks | Prompt |
|---|---|---|---|---|---|
| 3.1 | **Multi-seat schema + RLS.** New `seats` table (or `phone_numbers.parent_business_id` + `phone_numbers.label`). `businesses.plan_tier` already added in 2.2; add `seats_allowed` enforcement at provision-time. RLS policies must scope across all seats under one business. **The single most strategically important task in Phase 3.** | backend / migration | 2 days | 3.2, first Growth-tier deal | new prompt needed |
| 3.2 | **Multi-seat UI** — onboarding wizard supports adding additional locations; dashboard switches between seats; analytics aggregates across or filters per seat. | frontend | 3 days | first Growth-tier deal | new prompt needed |
| 3.3 | **Rate limiting** — `express-rate-limit` per [SECURITY_AUDIT_RESULTS.md §H2](SECURITY_AUDIT_RESULTS.md). `/demo/setup` 5/min/IP, `/api/*` GETs 60/min/business, `POST /booking` Vapi-tool path 30/min/business, `/call/vapi-callback` 200/min/business. Without this, one bad caller costs Twilio + Cartesia + LLM unbounded dollars. | backend | 0.5 day | bill-exhaustion vector closed | new prompt needed (small) |
| 3.4 | **PDPA — phone number hashing + erasure** — [SECURITY_AUDIT_RESULTS.md §M1, §M2](SECURITY_AUDIT_RESULTS.md). Add `caller_number_hash`. Add `DELETE /api/clients/:id` (auth-scoped) that anonymises bookings + cascades. Becomes High the moment Operis has paying customers in Thailand — i.e. now. | backend + frontend | 1.5 days | PDPA inquiry from any single customer | new prompt needed |
| 3.5 | **Data retention cron** — [SECURITY_AUDIT_RESULTS.md §M3](SECURITY_AUDIT_RESULTS.md). Archives or deletes `call_sessions` >13 months, cancelled bookings >24 months. | backend | 0.5 day | storage cost + PDPA audit | new prompt needed (small) |
| 3.6 | **Vapi tool call assistant-ID cross-check** — [SECURITY_AUDIT_RESULTS.md §M5](SECURITY_AUDIT_RESULTS.md). Look up `phone_numbers.vapi_agent_id` from the assistant ID Vapi sends; reject if body's `business_id` disagrees. Closes the leaked-tool-secret cross-tenant attack. | backend | 0.5 day | security posture for 50-customer scale | new prompt needed (small) |
| 3.7 | **Re-engagement Outreach — Layer 11.** Cron identifies clients overdue per their `recurrence_interval_days`; sends Thai SMS with re-book link. The single highest-ROI churn-reduction feature based on existing service data. | backend | 2 days | 4% churn target | new prompt needed |
| 3.8 | **No-Show Protection + Deposits — Layer 12.** Risk score per `clients` row (no-show count / total bookings); deposit collection via PromptPay or Stripe before high-risk bookings. Listed as Growth-tier feature in CONTEXT.md but practically: any Starter customer with a no-show problem will churn without it. | backend + frontend | 3 days | retention floor for high-no-show verticals (clinics, fitness) | new prompt needed |
| 3.9 | **Google Review Collection — Layer 13.** Post-booking SMS with one-tap review link. | backend | 1 day | local SEO for the customer = stickier customer | new prompt needed (small) |
| 3.10 | **Outbound calling engine.** Call recovery, follow-ups, deposit chasing. Bigger lift — but unblocks everything in Phase 4 marketing. | backend | 5 days | every Phase 4 outbound-driven feature | new prompt needed |
| 3.11 | **Webhook deep ops — failed payments + dunning automation.** Stripe `payment_failed` → SMS owner → suspend `phone_numbers.status` after 7 days → reactivate on retry success. | backend | 1 day | involuntary churn handled cleanly | new prompt needed |
| 3.12 | **Per-request anon-key Supabase client** — [SECURITY_AUDIT_RESULTS.md §M8](SECURITY_AUDIT_RESULTS.md). Move backend queries off the service-role key onto per-request anon-key clients with the user's JWT injected, so RLS becomes the actual wall (not a code-discipline issue). Defensive, not blocking, but cheap insurance at this scale. | backend | 1 day | RLS enforcement is real, not aspirational | new prompt needed |

**Phase 3 total effort:** ~21 working days. Honest critical path within Phase 3: 3.1/3.2 (multi-seat) is the strategy-bottleneck; 3.3/3.4/3.6 are the safety-bottleneck. They parallelize.

---

## Phase 4 — Growth Tier Unlock

**Goal:** every feature pillar that justifies the $149+$69/seat Growth price point and the $499+$59 Scale price point. By the end of this phase a 5-location chain has a reason to pick Operis over LINE Official Account + a Thai virtual receptionist service.

**Note on scope:** [STRATEGY.md §9 Outcome 1](STRATEGY.md) targets one Growth-tier deal in the next 90 days. That deal needs SOME of these features ready, not all of them. Realistic prioritisation: ship 4.1, 4.4, 4.5 to land the deal; the rest harden the upsell path for chains 2–10.

| # | Task | Layer | Effort | Blocks | Prompt |
|---|---|---|---|---|---|
| 4.1 | **Loyalty Points — Layer 14.** Points per booking + redemption flow. Per-tier configurable. Surfaced in client-facing SMS confirmations. The single feature most-referenced as the reason Thai SMBs renew. | backend + frontend | 3 days | retention | new prompt needed |
| 4.2 | **Seasonal Campaigns — Layer 17.** Pre-built calendar of Thai holidays (Songkran, Loi Krathong, Thai New Year, Mother's Day) — outbound SMS campaigns. Reuses the `thaiHolidays.js` data file already in the repo. | backend + frontend | 2 days | seasonal upsell, partial overlap with 3.10 outbound engine | new prompt needed |
| 4.3 | **Waitlist Management — Layer 18.** When a slot is fully booked, capture intent on the call; SMS the next waitlisted client when a cancellation creates a slot. Highest-impact feature for high-utilisation salons. | backend + frontend | 3 days | utilisation rate | new prompt needed |
| 4.4 | **Staff Optimisation — Layer 19.** Forecast peak hours from `bookings` + `call_sessions`; suggest staff schedule changes; surface staff utilisation per week. Sells the Growth tier on revenue-not-cost framing. | backend + frontend | 5 days | Growth-tier pitch | new prompt needed |
| 4.5 | **Full analytics dashboard.** Cohort retention, revenue per channel (organic / re-engagement / recovery), per-staff revenue, comparison vs prior month. Builds on 2.7. | frontend | 3 days | post-purchase justification for $149+ | new prompt needed |
| 4.6 | **Group bookings.** One booking represents N people. Required for clinics, fitness studios, group classes. | backend + frontend | 2 days | mid-market verticals | new prompt needed |
| 4.7 | **White-label AI persona per number** — Retention-tier feature in CONTEXT.md. Per-seat persona name + voice config + greeting customisation. Already partially possible via `provisionOrchestrator.js`; needs UI. | frontend + small backend | 2 days | Enterprise tier pitch | new prompt needed |
| 4.8 | **Reseller/Agency portal** — defer until $500K ARR signal per [STRATEGY.md §2 Agency channel rule](STRATEGY.md). Listed here for completeness, NOT because it should ship in this phase. | both | 5+ days | $500K ARR milestone | new prompt needed (deferred) |

**Phase 4 total effort:** ~20 working days for the 4.1–4.7 stack. 4.8 is explicitly deferred per strategy.

---

## CRITICAL PATH

The single sequence where if any one task slips, the whole timeline slips. Every other task can parallelise around this spine.

```
1.1 (rotate keys)         ← founder ops, ~30 min, blocking
   ↓
1.2 (apply migrations)    ← founder ops, ~30 min, blocking
   ↓
1.4 (set env vars)        ← founder ops, ~45 min, blocking
   ↓
1.7 (two-phase booking prompt + reprovision)  ← backend, 0.5 day
   ↓
1.8 (Twilio number purchase API)              ← backend, 0.5 day
   ↓
1.10 (landing page)        ← frontend, 1.5 days
   ↓
1.13 (live verification)   ← qa, 0.5 day
   ↓
═══ DEMO READY ═══
   ↓
2.1 (Stripe billing — Layer 6)                ← backend + frontend, 5 days
   ↓
2.2 (plan-tier enforcement)                   ← backend, 1 day
   ↓
2.12 (multi-tenant live test)                 ← qa, 0.5 day
   ↓
═══ FIRST 10 PAYING CUSTOMERS ═══
   ↓
3.1 + 3.2 (multi-seat schema + UI)            ← both, 5 days
   ↓
3.3 + 3.4 + 3.6 (rate limit + PDPA + tool sec) ← backend, 2.5 days
   ↓
═══ SAFE AT 50 CUSTOMERS ═══
   ↓
4.1 + 4.4 (loyalty + staff optimisation)      ← both, 8 days
   ↓
═══ GROWTH TIER UNLOCK ═══
```

### What is the *real* bottleneck?

Three honest answers, ranked:

1. **Stripe billing (2.1).** Manual PromptPay billing caps growth at ~50–80 accounts per [SECURITY_AUDIT_RESULTS.md §M4](SECURITY_AUDIT_RESULTS.md). Until Stripe ships, every paying customer is a hand-keyed PromptPay reconciliation. This is the single biggest product-side unlock per [STRATEGY.md §9 Outcome 3](STRATEGY.md). 5 days, no shortcuts — subscription products + webhooks + customer portal + tier enforcement is real work. **If Stripe slips by a week, Phase 2 slips by a week, full stop.**

2. **Founder ops in 1A.** None of the Phase 1B code matters until keys are rotated, migrations are applied, and env vars are set. These are 2 hours of human work that block 5 days of code work. The non-obvious failure mode: code work (1.5–1.12) gets done locally, deployed, and then silently fails in production because env vars aren't set. **Run 1A first, before any 1B code lands.**

3. **The percent-multi-seat-at-M18 metric (3.1/3.2).** This is the strategic bottleneck. Every other Phase 3 task improves churn or safety; multi-seat is the ONLY thing that changes the company's outcome column per [STRATEGY.md §8](STRATEGY.md). If 3.1+3.2 slip and the first Growth-tier deal in Outcome 1 of the 90-day plan can't be served, Operis is 🟡 lower-half forever. This is why multi-seat moved from Phase 4 (where the user's brief placed it) to Phase 3 in this document.

The bottleneck is NOT the landing page, the dashboard polish, or any feature in Phase 4. Those parallelise. The spine above is what matters.

---

_Last updated: 2026-04-24. Update at the start of every session if scope changes._
