# Operis — Strategy & Unit Economics

_Decision document — 2026-04-24_

This doc locks in pricing, unit economics, and the 5-year outlook. It replaces the pricing table in [CONTEXT.md](CONTEXT.md) and supersedes any prior revenue modeling. It is written to be read by the founder and, when the time comes, by investors.

---

## 1. Executive summary

Operis is an AI voice receptionist platform for service SMBs in Southeast Asia, starting in Thailand and expanding to the Philippines and Vietnam. The product is live and the backend is ~60% built out per [PROGRESS.md](PROGRESS.md).

**Pricing model:** platform fee + per-seat fee. One seat = one AI receptionist = one calendar/number. COGS scales with seats (~$22.83/seat/mo), so pricing must too.

**36-month target:** $5M ARR. **5-year target (good execution):** $12–20M ARR. **5-year ceiling (exceptional execution, funded):** $60–120M ARR.

**The single metric that decides which column we land in:** percent of new accounts that are multi-seat by month 18. <10% → lifestyle business. >30% → venture outcome. Today it is 0%.

---

## 2. Pricing (locked)

| SKU | Structure | Target customer | Avg seats | $/account |
|---|---|---|---|---|
| **Starter (Thailand)** | ฿2,990/mo, 1 seat | Solo Thai SMB | 1 | ฿2,990 (~$85) |
| **Starter (Intl)** | $89/mo, 1 seat | Solo SMB outside TH | 1 | $89 |
| **Growth** | $149 base + $69/seat | Small chains (2–10 locations) | 5 | $494 |
| **Scale** | $499 base + $59/seat | Mid-market chains (11–50) | 25 | $1,974 |
| **Enterprise** | $999 base + $49/seat | Franchise HQs (50+) | 75 | $4,674 |
| **Agency / Reseller** | $49/seat wholesale, 20-seat min | B2B2B resellers | 40 | $1,960 |

**Setup fees:** $0 Starter, $199 Growth, $499 Scale, $999 Enterprise, $0 Agency.

**Currency strategy:** Thai Starter denominated in THB (feels native, lower card friction). Everything else in USD (multi-market, enterprise and agencies expect USD).

**Agency channel rule:** do not invest in dedicated channel team until $500K ARR. Close inbound agency interest at this SKU; build the reseller portal when demand signals it.

**Overages:** call minutes, SMS, WhatsApp marketing messages billed per existing CONTEXT.md rates on top of platform + per-seat.

---

## 3. Unit economics

**COGS per seat: $22.83/mo**
- Voice AI + SIP: $20.00 (200 min × $0.10)
- LLM inference: $1.05 (300 conversations × $0.0035)
- SMS (TH): $1.00 (50 × $0.02)
- WhatsApp marketing: $0.78 (30 × $0.026)
- WhatsApp service: $0 (free tier)

**Gross margin and LTV by SKU** (at 1/churn):

| SKU | Revenue | COGS | GM | Monthly churn | LTV |
|---|---|---|---|---|---|
| Starter TH | $85 | $23 | 73% | 5% | $1,252 |
| Starter Intl | $89 | $23 | 74% | 5% | $1,323 |
| Growth | $494 | $114 | 77% | 3% | $12,861 |
| Scale | $1,974 | $571 | 71% | 2% | $70,662 |
| **Enterprise** | **$4,674** | **$1,712** | **63%** | **1%** | **$297,174** |
| Agency | $1,960 | $913 | 53% | 1.5% | $69,787 |

**Key ratio:** one Enterprise account = ~240× the LTV of a Starter account. One Agency account = ~53× Starter LTV.

**Fixed monthly burn (3-person team, Thailand-based): ~$6,254/mo.**
- Team (THB payroll): $4,429
- Infrastructure: $200
- Business ops: $1,625

**Implication:** Operis breaks even at approximately 75–100 accounts. A $100K pre-seed covers 36+ months on the modeled trajectory.

Full model: [tools/unit-economics.js](tools/unit-economics.js).

---

## 4. Market reality

**Addressable market (Thailand only):**
- ~3.2M registered SMEs (OSMEP). Target verticals (salons, clinics, beauty, fitness, tutoring): ~500–800K businesses.
- Filter for call volume + digital literacy + SaaS budget: realistic SAM ~100–200K businesses.
- At blended ARPU $207/account and 3–5% SMB SaaS penetration at maturity: **Thailand ceiling ≈ $6–12M ARR over 5–7 years standalone.**
- Adding Vietnam + Philippines: ~3× the opportunity, ~2× the execution cost.

**Competitive landscape:**
- Global: PolyAI ($70M+ raised, enterprise), Goodcall ($8.4M seed, reportedly sub-$5M ARR 2.5 yrs in), Rosie, Dialpad AI, Synthflow, Bland, Retell.
- Regional SEA: few Thai-first players with real localization. This is the wedge.
- Substitutes: LINE Official Accounts + chatbots (free to ฿1,500/mo) — the real pressure. Only relevant for call-heavy businesses, which is a subset of the SAM.

**Hard truth on defensibility:** Vapi, Retell, and Synthflow are commoditizing the agent itself. Moat must come from distribution (channel + brand), vertical workflow depth, and Thai voice quality — not the voice agent.

---

## 5. Base rate odds

Historical reference data for SMB SaaS cohorts, adjusted for emerging-market ARPU and the multi-seat/enterprise component:

| Milestone | Historical odds |
|---|---|
| Reaching $1M ARR | ~20–25% |
| Reaching $5M ARR | ~5–8% |
| Reaching $20M ARR | ~2–3% |
| Reaching $50M ARR | ~0.5–1% |
| Year-3 survival | ~40% |
| Year-5 survival | ~25% |

**What kills companies in this niche:**
1. Churn compounding (at 6% monthly, the business doesn't compound — period)
2. ARPU compression if Growth/Scale/Enterprise features (PROGRESS.md Layers 11–15) don't ship
3. Premature geographic expansion (70% failure rate when expanding pre-$2M ARR in home market)
4. Platform risk — Vapi/Twilio/Cartesia price or reliability hits flow directly to margin
5. Billing ops debt (current state — Stripe not built caps growth at ~50–80 accounts)

---

## 6. Key assumptions that must be true

| # | Assumption | Status |
|---|---|---|
| 1 | Thai SMBs will pay $80–275/mo for AI receptionist | 🔴 Unproven |
| 2 | Cartesia Thai voice quality retains customers past 14-day trial | 🟡 Partially proven |
| 3 | Blended CAC stays below ~$1,200 | 🔴 Unproven |
| 4 | Monthly account churn stays ≤4% blended | 🔴 Unproven |
| 5 | One small team can run TH + VN + PH in Year 1 | 🔴 Likely false; reset timeline |

Three of five are red. Treat every quarter until proven as assumption-validation work, not just product or sales work.

---

## 7. Five-year revenue projections

Scenarios assume seat-based pricing from Section 2, the cost structure from Section 3, and execution grades drawn from the SMB SaaS cohort in Section 5.

### 🔴 Poor execution (bottom 30% of cohort)

Never closes chain or enterprise deals. Stays 90%+ Starter. Churn creeps to 6–8%. Agency channel never materializes.

| | Accounts | Seats | Mix (Starter/Growth/Scale/Ent/Agency) | ARR |
|---|---|---|---|---|
| Year 1 | 80–120 | 85–130 | 95 / 5 / 0 / 0 / 0 | **$90–160K** |
| Year 3 | 300–500 | 380–650 | 85 / 12 / 3 / 0 / 0 | **$500–900K** |
| Year 5 | 500–900 | 700–1,200 | 80 / 15 / 4 / 0–1 / 0 | **$900K–1.6M** |

**Outcome:** zombie. Funds founder salary, no exit.

### 🟡 Good execution (top 25%)

Lands first chains by month 15. First enterprise logo month 20–24. Agencies start contributing Year 3. Churn holds ~4%. Lightly funded (~$300–500K pre-seed, ~$1M seed).

| | Accounts | Seats | Mix | ARR |
|---|---|---|---|---|
| Year 1 | 150–300 | 200–400 | 85 / 12 / 3 / 0 / 0 | **$300–600K** |
| Year 3 | 900–1,400 | 2,500–4,000 | 75 / 17 / 6 / 1 / 1 | **$3–5M** |
| Year 5 | 2,500–4,000 | 9,000–15,000 | 65 / 22 / 9 / 2 / 2 | **$12–20M** |

**Outcome:** profitable, sellable, lifestyle-plus. Hits $5M ARR around Year 3.

### 🟢 Exceptional execution (top 5%, funded)

Seed raise ($750K–1.5M) at month 12 on 200 accounts + 2 enterprise logos. Enterprise motion live by month 15. Agency program live by month 18. TH + PH + VN operational by Year 2. Churn 2–3%. Series A ($3–8M) at month 24–30.

| | Accounts | Seats | Mix | ARR |
|---|---|---|---|---|
| Year 1 | 400–700 | 900–1,500 | 75 / 18 / 6 / 1 / 0 | **$1.2–2.5M** |
| Year 3 | 2,500–4,000 | 12,000–20,000 | 55 / 25 / 13 / 4 / 3 | **$15–30M** |
| Year 5 | 7,000–12,000 | 50,000–90,000 | 40 / 28 / 20 / 7 / 5 | **$60–120M** |

**Outcome:** Series B or strategic acquisition. Enterprise ~25–30% of revenue. Agency ~10%.

### Honest median read

Most likely outcome on current trajectory: **🟡 lower half.** $3–5M ARR by Year 3, $8–15M by Year 5. Enough to fund the founder life and a sellable business; not yet a venture outcome.

---

## 8. The critical metric

**Percent of new accounts that are multi-seat by month 18.**

| Multi-seat % at M18 | Probable outcome column |
|---|---|
| <10% | 🔴 Poor |
| 15–25% | 🟡 Good |
| 30%+ | 🟢 Exceptional |

Today: 0%. Every product, sales, and marketing decision in the next 18 months should be measured against whether it increases this percentage. Starter logos are worth collecting (validation, word-of-mouth, CS feedback, LTV cover for fixed costs) but they do not determine the 5-year outcome.

---

## 9. 90-day plan

Three outcomes to force by end of 2026-Q3:

### Outcome 1 — Close one Growth tier deal
**Who:** a Thai small chain, 3–8 locations. Beauty, clinic, or fitness vertical.
**Pitch:** $149 + $69/seat, $199 setup. 14-day free trial. Reference pricing: less than one part-time receptionist salary per location.
**Success =** live multi-seat account, reference customer, recorded testimonial.
**Signal if it fails:** the Growth product isn't actually ready or the pitch doesn't land. Revise before scaling the sales motion.

### Outcome 2 — One enterprise conversation to proposal stage
**Who:** a 20+ location Thai franchise HQ. Shortlist: Thai franchise beauty chains, dental groups, clinic chains.
**Pitch:** Enterprise tier ($999 + $49/seat), white-label AI persona per location, API integration, dedicated AM.
**Success =** proposal sent, pilot scope agreed, timeline committed.
**Signal if it fails:** enterprise sales motion isn't real yet; re-plan around 🟡 range and hire a specialist seller before trying again.

### Outcome 3 — Ship Stripe billing (PROGRESS.md Layer 6)
Current PromptPay-manual billing caps growth at ~50–80 accounts and makes Growth/Scale/Enterprise contracts ops-impossible. This is the single biggest product-side unlock.

**Success =** platform-fee + per-seat + overage billing live, self-serve signup for Starter/Growth, contract-style for Scale/Enterprise.

**Decision gate on Day 90:**
- Outcomes 1 + 2 + 3 all hit → start Seed conversations; you're tracking 🟢
- Outcomes 1 + 3 hit, not 2 → stay on 🟡 plan; revisit enterprise in 6 months
- Only 3 hits → scale Starter/Growth motion on the new billing; don't touch enterprise yet
- None hit → step back and figure out whether the market is responding

---

## 10. Follow-ups to this document

1. Update pricing table in [CONTEXT.md](CONTEXT.md) to match Section 2.
2. Add CAC/churn/phase-slip sensitivity toggles to [tools/unit-economics.js](tools/unit-economics.js) so the model can be stress-tested.
3. Build reseller portal + white-label spec — deferred until $500K ARR signal.
4. Revisit this doc every quarter with actuals vs. plan.

---

_Last updated: 2026-04-24_
