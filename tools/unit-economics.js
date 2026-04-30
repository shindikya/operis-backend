#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
// OPERIS — Seat-Based Unit Economics & Pricing Calculator (v2)
// ═══════════════════════════════════════════════════════════════════════════
// Run: node tools/unit-economics.js
// All inputs are adjustable constants below.
//
// Pricing model: platform fee + per-seat fee. One seat = one AI receptionist
// = one calendar/number. COGS scales with seats, so price must too.
// ═══════════════════════════════════════════════════════════════════════════

// ── ADJUSTABLE INPUTS ────────────────────────────────────────────────────

const FX_RATE = 35; // THB per USD

// INFRASTRUCTURE COSTS (USD)
const VOICE_COST_PER_MIN        = 0.085;
const WHATSAPP_MARKETING_MSG    = 0.026;
const WHATSAPP_SERVICE_MSG      = 0.000;
const LLM_COST_PER_CONVERSATION = 0.0035;
const SMS_COST_THAILAND         = 0.02;
const SIP_TRUNK_PER_MIN         = 0.015;
const CLOUD_HOSTING_MONTHLY     = 150;
const DATABASE_STORAGE_MONTHLY  = 50;

// TEAM COSTS (THB/mo, Thailand-based)
const FOUNDER_SALARY_THB = 80000;
const SALES_SALARY_THB   = 40000;
const CS_SALARY_THB      = 35000;

// BUSINESS COSTS (USD)
const SINGAPORE_HOLDING_ANNUAL = 1500;
const TOOLS_SOFTWARE_MONTHLY   = 500;
const MARKETING_BUDGET_MONTHLY = 1000;

// USAGE PER SEAT / MONTH
const AVG_CALL_MINUTES      = 200;
const AVG_WHATSAPP_SERVICE  = 150;
const AVG_WINBACK_SMS       = 50;
const AVG_WINBACK_WHATSAPP  = 30;
const AVG_LLM_CONVERSATIONS = 300;

// PRICING — platform fee + per-seat, USD
// Thai Starter denominated in THB, converted to USD for modeling.
const PRICING = {
  starter_th:   { platform: 0,   perSeat: 2990 / FX_RATE, avgSeats: 1,  label: 'Starter (Thailand, THB)' },
  starter_intl: { platform: 0,   perSeat: 89,             avgSeats: 1,  label: 'Starter (Intl, USD)' },
  growth:       { platform: 149, perSeat: 69,             avgSeats: 5,  label: 'Growth (2–10 seats)' },
  scale:        { platform: 499, perSeat: 59,             avgSeats: 25, label: 'Scale (11–50 seats)' },
  enterprise:   { platform: 999, perSeat: 49,             avgSeats: 75, label: 'Enterprise (50+ seats)' },
  agency:       { platform: 0,   perSeat: 49,             avgSeats: 40, label: 'Agency (wholesale)' },
};

const SETUP_FEES = {
  starter_th: 0, starter_intl: 0,
  growth: 199, scale: 499, enterprise: 999, agency: 0,
};

// Monthly account churn by tier
const CHURN = {
  starter_th: 0.05, starter_intl: 0.05,
  growth: 0.03, scale: 0.02, enterprise: 0.01, agency: 0.015,
};

// GROWTH MODEL — new ACCOUNTS per tier per month
const GROWTH_PHASES = [
  { months: [1, 6],   label: 'Door-to-door Bangkok',
    accounts: { starter_th: 5,  starter_intl: 0,  growth: 0,  scale: 0, enterprise: 0, agency: 0 } },
  { months: [7, 12],  label: 'Paid acquisition + first chains',
    accounts: { starter_th: 15, starter_intl: 2,  growth: 2,  scale: 0, enterprise: 0, agency: 0 } },
  { months: [13, 18], label: 'PH/VN expansion',
    accounts: { starter_th: 20, starter_intl: 10, growth: 5,  scale: 1, enterprise: 0, agency: 1 } },
  { months: [19, 24], label: 'Enterprise motion',
    accounts: { starter_th: 30, starter_intl: 20, growth: 10, scale: 3, enterprise: 1, agency: 2 } },
  { months: [25, 36], label: 'Seed deployed',
    accounts: { starter_th: 50, starter_intl: 40, growth: 25, scale: 8, enterprise: 2, agency: 4 } },
];

// TEAM SCALING (headcount by MRR threshold)
const TEAM_SCALING = [
  { mrrThreshold: 0,      headcount: 3,  addedCostUSD: 0 },
  { mrrThreshold: 10000,  headcount: 5,  addedCostUSD: 2200 },
  { mrrThreshold: 25000,  headcount: 8,  addedCostUSD: 4400 },
  { mrrThreshold: 50000,  headcount: 12, addedCostUSD: 7700 },
  { mrrThreshold: 100000, headcount: 20, addedCostUSD: 15000 },
  { mrrThreshold: 250000, headcount: 35, addedCostUSD: 30000 },
  { mrrThreshold: 500000, headcount: 55, addedCostUSD: 55000 },
];

const FUNDING_AMOUNTS = [100000, 300000, 500000, 1000000, 2000000];


// ── HELPERS ──────────────────────────────────────────────────────────────

const fmtUSD  = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtUSD2 = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTHB  = n => '฿' + Math.round(n).toLocaleString('en-US');
const fmtPct  = n => (n * 100).toFixed(1) + '%';
const pad = (s, len, align = 'left') => align === 'right' ? String(s).padStart(len) : String(s).padEnd(len);
const line = (ch = '─', len = 90) => ch.repeat(len);
function header(title) {
  console.log('\n' + line('═'));
  console.log('  ' + title);
  console.log(line('═'));
}


// ── COGS PER SEAT ────────────────────────────────────────────────────────

function cogsPerSeat() {
  return (
    AVG_CALL_MINUTES * (VOICE_COST_PER_MIN + SIP_TRUNK_PER_MIN) +
    AVG_WHATSAPP_SERVICE * WHATSAPP_SERVICE_MSG +
    AVG_WINBACK_WHATSAPP * WHATSAPP_MARKETING_MSG +
    AVG_WINBACK_SMS * SMS_COST_THAILAND +
    AVG_LLM_CONVERSATIONS * LLM_COST_PER_CONVERSATION
  );
}


// ── 1. FIXED COSTS ───────────────────────────────────────────────────────

function calculateFixedCosts() {
  header('1. FIXED OPERATIONAL COSTS (MONTHLY)');

  const teamThb = FOUNDER_SALARY_THB + SALES_SALARY_THB + CS_SALARY_THB;
  const teamUSD = teamThb / FX_RATE;
  const infra = CLOUD_HOSTING_MONTHLY + DATABASE_STORAGE_MONTHLY;
  const biz = SINGAPORE_HOLDING_ANNUAL / 12 + TOOLS_SOFTWARE_MONTHLY + MARKETING_BUDGET_MONTHLY;
  const total = teamUSD + infra + biz;

  console.log(`\n  Team (3 founders, TH-based)   ${fmtTHB(teamThb).padStart(14)}   ${fmtUSD2(teamUSD).padStart(10)}/mo`);
  console.log(`  Infrastructure (cloud + DB)                               ${fmtUSD2(infra).padStart(10)}/mo`);
  console.log(`  Business (SG holding, tools, marketing)                   ${fmtUSD2(biz).padStart(10)}/mo`);
  console.log(line('─'));
  console.log(`  TOTAL FIXED BURN                                          ${fmtUSD2(total).padStart(10)}/mo`);

  return { teamUSD, infra, biz, total };
}


// ── 2. UNIT ECONOMICS BY SKU ─────────────────────────────────────────────

function calculateUnitEconomics() {
  header('2. UNIT ECONOMICS BY SKU');
  const cogsSeat = cogsPerSeat();

  console.log(`\n  COGS per seat (${AVG_CALL_MINUTES} voice min + SMS + WA + LLM):  ${fmtUSD2(cogsSeat)}/mo`);
  console.log(`  Scales linearly with seats — NOT with accounts.`);

  console.log('\n  PRICING TABLE');
  console.log('  ' + line('─', 104));
  console.log('  ' +
    pad('SKU', 30) +
    pad('Platform', 10) +
    pad('Per seat', 10) +
    pad('Avg seats', 10) +
    pad('$/account', 12) +
    pad('COGS', 10) +
    pad('GM', 8) +
    'Churn/mo'
  );
  console.log('  ' + line('─', 104));

  const tiers = {};
  for (const [key, t] of Object.entries(PRICING)) {
    const revenue = t.platform + t.perSeat * t.avgSeats;
    const cogs = cogsSeat * t.avgSeats;
    const margin = revenue - cogs;
    const gmPct = margin / revenue;
    const ltv = (1 / CHURN[key]) * margin + SETUP_FEES[key];
    tiers[key] = { ...t, revenue, cogs, margin, gmPct, ltv, churn: CHURN[key] };

    console.log('  ' +
      pad(t.label, 30) +
      pad(fmtUSD(t.platform), 10) +
      pad(fmtUSD(t.perSeat), 10) +
      pad(t.avgSeats, 10) +
      pad(fmtUSD(revenue), 12) +
      pad(fmtUSD(cogs), 10) +
      pad(fmtPct(gmPct), 8) +
      fmtPct(CHURN[key])
    );
  }

  console.log('\n  LTV BY SKU');
  console.log('  ' + line('─', 70));
  console.log('  ' + pad('SKU', 30) + pad('Margin/mo', 14) + pad('Setup', 10) + 'LTV (margin × 1/churn + setup)');
  for (const [key, r] of Object.entries(tiers)) {
    console.log('  ' +
      pad(r.label, 30) +
      pad(fmtUSD(r.margin), 14) +
      pad(fmtUSD(SETUP_FEES[key]), 10) +
      fmtUSD(r.ltv)
    );
  }

  return { cogsSeat, tiers };
}


// ── 3. PRICING RATIONALE ─────────────────────────────────────────────────

function pricingRationale(ue) {
  header('3. PRICING STRATEGY');

  console.log(`
  CORE PRINCIPLE
  ${line('─', 70)}
  Price per seat, not per account. One seat = one AI receptionist =
  one calendar/number. COGS scales with seats (~${fmtUSD2(ue.cogsSeat)}/seat),
  so pricing must too. A 50-location chain is 50× the infra load of
  a solo salon — it cannot pay a flat $899 and leave margin on the table.

  STRUCTURE
  ${line('─', 70)}
  Platform fee + per-seat fee. Platform fee covers account-level cost
  (support, onboarding, dashboard, AM time). Per-seat declines with
  volume but never below the COGS floor of ~${fmtUSD2(ue.cogsSeat)}.

  Starter — ฿2,990 (TH) / $89 (Intl), 1 seat, no setup
    Entry point. Below the cost of a part-time receptionist.
    Purpose: product validation, word-of-mouth funnel into multi-seat tiers.

  Growth — $149 base + $69/seat (2–10 seats)
    Small chains, multi-location SMBs. 5-seat account = $494/mo.
    ~77% GM. Setup fee $199 (covers multi-location config).

  Scale — $499 base + $59/seat (11–50 seats)
    Mid-market chains. 25-seat account = $1,974/mo.
    ~71% GM. Setup fee $499.

  Enterprise — $999 base + $49/seat (50+ seats)
    Franchise HQs, large chains. 75-seat account = $4,674/mo.
    Custom contract, API access, white-label options, dedicated AM,
    priority SLA. Setup fee $999.

  Agency / Reseller — $49/seat wholesale, 20-seat minimum
    B2B2B distribution channel. Agencies resell to end-clients at
    retail prices and keep the margin. White-label, API, co-branded.
    Target: 10–20% of revenue mix at scale. Do NOT invest in dedicated
    channel team until $500K ARR; until then, close inbound only.

  CURRENCY
  ${line('─', 70)}
    Thai Starter:  THB (native pricing, lower credit-card friction)
    Everything else: USD (multi-market, enterprise/agency expect USD)
  `);
}


// ── 4. 36-MONTH REVENUE MODEL ────────────────────────────────────────────

function revenueModel(fixed, ue) {
  header('4. REVENUE MODEL — 36 MONTHS');

  const accounts = Object.fromEntries(Object.keys(PRICING).map(k => [k, 0]));
  const months = [];

  for (let m = 1; m <= 36; m++) {
    const phase = GROWTH_PHASES.find(p => m >= p.months[0] && m <= p.months[1]);

    if (phase) {
      for (const [k, n] of Object.entries(phase.accounts)) accounts[k] += n;
    }

    let mrr = 0, seats = 0, variableCosts = 0;
    for (const [k, t] of Object.entries(PRICING)) {
      const accountMrr = accounts[k] * (t.platform + t.perSeat * t.avgSeats);
      const accountSeats = accounts[k] * t.avgSeats;
      mrr += accountMrr;
      seats += accountSeats;
      variableCosts += accountSeats * ue.cogsSeat;
    }

    const teamCost = getTeamCost(mrr);
    const headcount = getHeadcount(mrr);
    const totalCosts = teamCost + fixed.infra + fixed.biz + variableCosts;
    const profit = mrr - totalCosts;
    const totalAccounts = Object.values(accounts).reduce((a, b) => a + b, 0);

    months.push({
      month: m, phase: phase?.label || '',
      accounts: { ...accounts },
      totalAccounts, seats, mrr, arr: mrr * 12,
      variableCosts, teamCost, totalCosts, profit, headcount,
    });

    for (const k of Object.keys(accounts)) {
      accounts[k] = accounts[k] * (1 - CHURN[k]);
    }
  }

  console.log('\n  QUARTERLY SNAPSHOT');
  console.log('  ' + line('─', 100));
  console.log('  ' +
    pad('Mo', 4) + pad('Phase', 28) + pad('Accts', 7) + pad('Seats', 8) +
    pad('MRR', 11) + pad('ARR', 12) + pad('Costs', 11) + pad('Profit', 11) + 'HC'
  );
  console.log('  ' + line('─', 100));

  [1, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].forEach(m => {
    const d = months[m - 1];
    const profitStr = d.profit >= 0 ? fmtUSD(d.profit) : '-' + fmtUSD(Math.abs(d.profit));
    console.log('  ' +
      pad(m, 4) +
      pad(d.phase.substring(0, 27), 28) +
      pad(Math.round(d.totalAccounts), 7) +
      pad(Math.round(d.seats), 8) +
      pad(fmtUSD(d.mrr), 11) +
      pad(fmtUSD(d.arr), 12) +
      pad(fmtUSD(d.totalCosts), 11) +
      pad(profitStr, 11) +
      d.headcount
    );
  });

  console.log('\n  MRR GROWTH');
  console.log('  ' + line('─', 70));
  const maxMrr = months[35].mrr;
  const chartWidth = 50;
  [1, 6, 12, 18, 24, 30, 36].forEach(m => {
    const d = months[m - 1];
    const barLen = Math.max(1, Math.round((d.mrr / maxMrr) * chartWidth));
    const marker = d.profit >= 0 ? ' ✓' : '';
    console.log(`  M${String(m).padStart(2)}  ${'█'.repeat(barLen)} ${fmtUSD(d.mrr)}${marker}`);
  });

  const breakeven = months.find(m => m.profit >= 0);
  if (breakeven) {
    console.log(`\n  BREAKEVEN: Month ${breakeven.month} at ${fmtUSD(breakeven.mrr)} MRR (${Math.round(breakeven.totalAccounts)} accounts, ${Math.round(breakeven.seats)} seats)`);
  } else {
    console.log(`\n  Not profitable by month 36 on this trajectory.`);
  }

  const m36 = months[35];
  console.log(`\n  BLENDED METRICS AT MONTH 36`);
  console.log('  ' + line('─', 60));
  console.log(`  ARPU per account:    ${fmtUSD(m36.mrr / m36.totalAccounts)}/mo`);
  console.log(`  ARPU per seat:       ${fmtUSD(m36.mrr / m36.seats)}/mo`);
  console.log(`  Avg seats/account:   ${(m36.seats / m36.totalAccounts).toFixed(1)}`);

  return months;
}

function getHeadcount(mrr) {
  let hc = 3;
  for (const t of TEAM_SCALING) if (mrr >= t.mrrThreshold) hc = t.headcount;
  return hc;
}
function getTeamCost(mrr) {
  const base = (FOUNDER_SALARY_THB + SALES_SALARY_THB + CS_SALARY_THB) / FX_RATE;
  let added = 0;
  for (const t of TEAM_SCALING) if (mrr >= t.mrrThreshold) added = t.addedCostUSD;
  return base + added;
}


// ── 5. FUNDING ───────────────────────────────────────────────────────────

function fundingAnalysis(months) {
  header('5. FUNDING REQUIREMENTS');

  let cash = 0, maxDeficit = 0, deficitMonth = 0;
  for (const m of months) {
    cash += m.profit;
    if (cash < maxDeficit) { maxDeficit = cash; deficitMonth = m.month; }
  }

  console.log(`\n  Max cumulative deficit: ${fmtUSD(Math.abs(maxDeficit))} (month ${deficitMonth})`);
  console.log(`  Minimum raise (30% buffer): ${fmtUSD(Math.abs(maxDeficit) * 1.3)}`);

  console.log('\n  RUNWAY BY FUNDING AMOUNT');
  console.log('  ' + line('─', 80));
  console.log('  ' + pad('Raise', 12) + pad('Runway', 12) + pad('Cash @ M12', 14) + pad('Cash @ M24', 14) + pad('Cash @ M36', 14) + 'Status');
  for (const amt of FUNDING_AMOUNTS) {
    let c = amt, runway = 0;
    for (const m of months) {
      c += m.profit;
      if (c > 0) runway = m.month; else break;
    }
    let c12 = amt, c24 = amt, c36 = amt;
    for (let i = 0; i < months.length; i++) {
      if (i < 12) c12 += months[i].profit;
      if (i < 24) c24 += months[i].profit;
      c36 += months[i].profit;
    }
    const status = c36 > 0 ? 'Sustainable' : 'Needs more';
    console.log('  ' +
      pad(fmtUSD(amt), 12) +
      pad(runway < 36 ? runway + ' mo' : '36+ mo', 12) +
      pad(fmtUSD(Math.round(c12)), 14) +
      pad(fmtUSD(Math.round(c24)), 14) +
      pad(fmtUSD(Math.round(c36)), 14) +
      status
    );
  }

  console.log(`
  WHEN TO RAISE
  ${line('─', 70)}
  Pre-seed ($150–300K):   Before launch or at <$10K MRR
    Prove product works, first 100 accounts, nail SMB unit economics.
    TH cost structure: $200K funds ~18–24 months with 3-person team.

  Seed ($750K–1.5M):      At $30–60K MRR with first Scale/Enterprise logos
    Hire enterprise sales, expand to PH/VN, build agency program.
    Proof points: <5% blended churn, >65% GM, first 5-figure ACV deals.

  Series A ($3–8M):       At $150K+ MRR ($2M+ ARR)
    Scale enterprise + agency, 4–5 markets, 50-person team.
    Proof points: NRR >110%, agency channel >10% of revenue.
  `);
}


// ── 6. PATH TO $5M ARR ──────────────────────────────────────────────────

function pathToFiveM() {
  header('6. PATH TO $5M ARR ($417K MRR)');

  const targetMrr = 5_000_000 / 12;

  const mix = {
    starter_th:   1300,
    starter_intl: 450,
    growth:       190,
    scale:        48,
    enterprise:   11,
    agency:       13,
  };

  let mrr = 0, seats = 0;
  const rows = [];
  for (const [k, n] of Object.entries(mix)) {
    const t = PRICING[k];
    const rev = n * (t.platform + t.perSeat * t.avgSeats);
    const s = n * t.avgSeats;
    mrr += rev;
    seats += s;
    rows.push({ label: t.label, n, s, rev });
  }

  const totalAccounts = Object.values(mix).reduce((a, b) => a + b, 0);
  const starterAccounts = mix.starter_th + mix.starter_intl;
  const starterRev = rows[0].rev + rows[1].rev;

  console.log(`\n  Target: ${fmtUSD(targetMrr)}/mo MRR  (${fmtUSD(targetMrr * 12)} ARR)`);
  console.log('\n  REALISTIC ACCOUNT MIX TO HIT $5M ARR');
  console.log('  ' + line('─', 80));
  console.log('  ' + pad('SKU', 30) + pad('Accounts', 12) + pad('Seats', 10) + pad('MRR', 12) + '% of MRR');
  console.log('  ' + line('─', 80));

  for (const r of rows) {
    console.log('  ' +
      pad(r.label, 30) +
      pad(r.n.toLocaleString(), 12) +
      pad(r.s.toLocaleString(), 10) +
      pad(fmtUSD(r.rev), 12) +
      fmtPct(r.rev / mrr)
    );
  }
  console.log('  ' + line('─', 80));
  console.log('  ' +
    pad('TOTAL', 30) +
    pad(totalAccounts.toLocaleString(), 12) +
    pad(seats.toLocaleString(), 10) +
    pad(fmtUSD(mrr), 12) +
    '100%'
  );

  console.log(`\n  Blended ARPU per account:  ${fmtUSD(mrr / totalAccounts)}/mo`);
  console.log(`  Blended ARPU per seat:     ${fmtUSD(mrr / seats)}/mo`);
  console.log(`  Avg seats per account:     ${(seats / totalAccounts).toFixed(1)}`);

  console.log(`
  INSIGHT
  ${line('─', 70)}
  SMB-only path:      ${Math.ceil(targetMrr / 89).toLocaleString()} accounts (impossible)
  Seat-based path:    ${totalAccounts.toLocaleString()} accounts, ${seats.toLocaleString()} seats

  Of those ${totalAccounts.toLocaleString()} accounts:
    • ${starterAccounts.toLocaleString()} Starter accounts (${fmtPct(starterAccounts / totalAccounts)} of logos)
      contribute ~${fmtPct(starterRev / mrr)} of revenue.
    • ${(totalAccounts - starterAccounts).toLocaleString()} multi-seat accounts (${fmtPct((totalAccounts - starterAccounts) / totalAccounts)} of logos)
      contribute ~${fmtPct(1 - starterRev / mrr)} of revenue.

  One Enterprise account = ~${Math.round((PRICING.enterprise.platform + PRICING.enterprise.perSeat * PRICING.enterprise.avgSeats) / PRICING.starter_intl.perSeat)} Starter accounts in MRR.
  One Agency account = ~${Math.round((PRICING.agency.perSeat * PRICING.agency.avgSeats) / PRICING.starter_intl.perSeat)} Starter accounts in MRR.

  Starter is a funnel. Multi-seat is the business.
  `);
}


// ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────

function execSummary(fixed, ue, months) {
  header('EXECUTIVE SUMMARY');
  const breakeven = months.find(m => m.profit >= 0);
  const m12 = months[11], m24 = months[23], m36 = months[35];

  console.log(`
  OPERIS — Seat-Based Unit Economics
  Generated ${new Date().toISOString().split('T')[0]}

  COST STRUCTURE
    Fixed monthly burn (3 founders):     ${fmtUSD2(fixed.total)}/mo
    COGS per seat:                       ${fmtUSD2(ue.cogsSeat)}/mo

  PRICING ANCHORS
    Starter TH / Intl:    ฿2,990 / $89        (1 seat)
    Growth:               $149 + $69/seat     (avg 5 seats = $494)
    Scale:                $499 + $59/seat     (avg 25 seats = $1,974)
    Enterprise:           $999 + $49/seat     (avg 75 seats = $4,674)
    Agency (wholesale):   $49/seat            (avg 40 seats = $1,960)

  36-MONTH TRAJECTORY
    Breakeven:            Month ${breakeven ? breakeven.month : 'not reached'}${breakeven ? ' at ' + fmtUSD(breakeven.mrr) + ' MRR' : ''}
    Year 1 MRR / ARR:     ${fmtUSD(m12.mrr)} / ${fmtUSD(m12.arr)}
    Year 1 accounts:      ${Math.round(m12.totalAccounts)} (${Math.round(m12.seats)} seats)
    Year 2 MRR / ARR:     ${fmtUSD(m24.mrr)} / ${fmtUSD(m24.arr)}
    Year 3 MRR / ARR:     ${fmtUSD(m36.mrr)} / ${fmtUSD(m36.arr)}
    Year 3 accounts:      ${Math.round(m36.totalAccounts)} (${Math.round(m36.seats)} seats)

  BOTTOM LINE
    Seat-based pricing protects gross margin as accounts grow and
    makes the enterprise + agency math actually work. Starter is a
    validation funnel, not a revenue driver — at $5M ARR, Starter is
    ~85% of logos but only ~35% of revenue.

    The growth trajectory in this model assumes top-quartile execution:
    working sales motion by M12, enterprise deals landing by M19,
    agency channel contributing by M24. Lower execution = stretch
    every milestone 6–12 months.

    Biggest single risk: blended monthly churn > 4%. At 6% the model
    breaks. Retention levers: onboarding quality, voice quality in
    TH/VN/PH, multi-seat expansion within existing accounts.
  `);
}


// ── RUN ──────────────────────────────────────────────────────────────────

console.log('\n' + line('═'));
console.log('  OPERIS — Seat-Based Unit Economics & Pricing Model');
console.log('  ' + new Date().toISOString().split('T')[0]);
console.log(line('═'));

const fixed = calculateFixedCosts();
const ue = calculateUnitEconomics();
pricingRationale(ue);
const months = revenueModel(fixed, ue);
fundingAnalysis(months);
pathToFiveM();
execSummary(fixed, ue, months);
