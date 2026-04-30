# ============================================================
# OPERIS — DEAL PROFITABILITY STRESS TEST
# Make sure we never lose money per deal
# ============================================================

# ============================================================
# CORE ASSUMPTIONS (edit these freely)
# ============================================================

USD_TO_THB = 35

# COGS per customer per month (from previous model)
COGS_PER_CUSTOMER_USD = 22.83

# COGS breakdown (for reference)
COGS_BREAKDOWN = {
    "voice_ai_200_mins": 8.00,        # $0.04/min x 200 mins
    "whatsapp_conversations": 0.00,   # Free (service window)
    "whatsapp_marketing_30": 0.78,    # $0.026 x 30 messages
    "llm_inference_300": 0.90,        # $0.003 x 300 conversations
    "sms_50": 1.00,                   # $0.02 x 50 messages
    "cloud_hosting_per_customer": 2.00,
    "telephony_sip": 1.50,
    "support_overhead": 1.65,
    "payment_processing_3pct": 2.67,  # on $89 avg price
    "buffer_10pct": 4.33,
}

# ============================================================
# DEAL TYPES — WHAT WE CHARGE
# ============================================================

deals = [
    {
        "name": "Individual SMB — Basic",
        "type": "smb",
        "locations": 1,
        "monthly_fee_thb": 2990,
        "setup_fee_thb": 5000,
        "contract_months": 1,
        "notes": "Single salon, clinic, auto repair"
    },
    {
        "name": "Individual SMB — Pro",
        "type": "smb",
        "locations": 1,
        "monthly_fee_thb": 4990,
        "setup_fee_thb": 8000,
        "contract_months": 1,
        "notes": "Single business, full features + win-back"
    },
    {
        "name": "Small Chain — 3 locations",
        "type": "chain",
        "locations": 3,
        "monthly_fee_thb": 3500,   # per location
        "setup_fee_thb": 20000,
        "contract_months": 12,
        "notes": "3-location salon or dental group"
    },
    {
        "name": "Small Chain — 5 locations",
        "type": "chain",
        "locations": 5,
        "monthly_fee_thb": 3500,
        "setup_fee_thb": 20000,
        "contract_months": 12,
        "notes": "5-clinic dental group or spa chain"
    },
    {
        "name": "Mid Chain — 10 locations",
        "type": "chain",
        "locations": 10,
        "monthly_fee_thb": 3200,   # slight discount at scale
        "setup_fee_thb": 35000,
        "contract_months": 12,
        "notes": "10-location wellness or salon franchise"
    },
    {
        "name": "Mid Chain — 15 locations",
        "type": "chain",
        "locations": 15,
        "monthly_fee_thb": 3000,
        "setup_fee_thb": 50000,
        "contract_months": 12,
        "notes": "15-location chain e.g. Health Land"
    },
    {
        "name": "Enterprise — 30 locations",
        "type": "enterprise",
        "locations": 30,
        "monthly_fee_thb": 2800,
        "setup_fee_thb": 80000,
        "contract_months": 12,
        "notes": "Large chain e.g. Oasis Spa"
    },
    {
        "name": "Enterprise — 60 locations",
        "type": "enterprise",
        "locations": 60,
        "monthly_fee_thb": 2500,
        "setup_fee_thb": 150000,
        "contract_months": 12,
        "notes": "Let's Relax Spa scale"
    },
    {
        "name": "Philippines SMB",
        "type": "smb",
        "locations": 1,
        "monthly_fee_thb": 2500,   # slightly lower for PH market
        "setup_fee_thb": 3000,
        "contract_months": 1,
        "notes": "Philippine salon or clinic"
    },
    {
        "name": "Philippines Chain — 5 locations",
        "type": "chain",
        "locations": 5,
        "monthly_fee_thb": 3000,
        "setup_fee_thb": 15000,
        "contract_months": 12,
        "notes": "Philippine wellness chain"
    },
]

# ============================================================
# ONBOARDING COST (your time to set up each deal)
# ============================================================

ONBOARDING_HOURS = {
    "smb": 2,          # hours to onboard a single SMB
    "chain": 8,        # hours to onboard a chain
    "enterprise": 20,  # hours to onboard enterprise
}

FOUNDER_HOURLY_RATE_USD = 15  # conservative Thailand rate

# ============================================================
# CALCULATIONS
# ============================================================

def calculate_deal(deal):
    locations = deal["locations"]
    monthly_fee_usd = (deal["monthly_fee_thb"] * locations) / USD_TO_THB
    setup_fee_usd = deal["setup_fee_thb"] / USD_TO_THB
    contract_months = deal["contract_months"]
    deal_type = deal["type"]

    # Monthly COGS — scale with locations
    # Enterprise gets slight efficiency gain (shared infra)
    efficiency = 1.0 if deal_type == "smb" else 0.92 if deal_type == "chain" else 0.85
    monthly_cogs = COGS_PER_CUSTOMER_USD * locations * efficiency

    # Onboarding cost (one-time)
    onboarding_cost = ONBOARDING_HOURS[deal_type] * FOUNDER_HOURLY_RATE_USD

    # Monthly gross profit
    monthly_gross_profit = monthly_fee_usd - monthly_cogs
    monthly_gross_margin_pct = (monthly_gross_profit / monthly_fee_usd) * 100

    # Contract total value
    total_contract_revenue = (monthly_fee_usd * contract_months) + setup_fee_usd
    total_contract_cogs = (monthly_cogs * contract_months) + onboarding_cost
    total_contract_profit = total_contract_revenue - total_contract_cogs
    total_contract_margin_pct = (total_contract_profit / total_contract_revenue) * 100

    # Months to recover onboarding cost
    if monthly_gross_profit > 0:
        months_to_recover = onboarding_cost / monthly_gross_profit
    else:
        months_to_recover = float('inf')

    # Annual value (ARR contribution)
    arr = monthly_fee_usd * 12

    return {
        "name": deal["name"],
        "type": deal_type,
        "locations": locations,
        "monthly_fee_usd": round(monthly_fee_usd, 2),
        "monthly_fee_thb": deal["monthly_fee_thb"] * locations,
        "setup_fee_usd": round(setup_fee_usd, 2),
        "monthly_cogs_usd": round(monthly_cogs, 2),
        "monthly_gross_profit": round(monthly_gross_profit, 2),
        "monthly_gross_margin_pct": round(monthly_gross_margin_pct, 1),
        "total_contract_revenue": round(total_contract_revenue, 2),
        "total_contract_profit": round(total_contract_profit, 2),
        "total_contract_margin_pct": round(total_contract_margin_pct, 1),
        "months_to_recover_onboarding": round(months_to_recover, 1),
        "arr": round(arr, 2),
        "profitable": monthly_gross_profit > 0,
        "notes": deal["notes"]
    }

# ============================================================
# MINIMUM VIABLE PRICE CALCULATOR
# What is the absolute floor price per location?
# ============================================================

def minimum_price(deal_type, locations):
    efficiency = 1.0 if deal_type == "smb" else 0.92 if deal_type == "chain" else 0.85
    monthly_cogs_per_location = COGS_PER_CUSTOMER_USD * efficiency
    # Add 40% minimum margin floor
    min_price_usd = monthly_cogs_per_location / 0.60
    min_price_thb = min_price_usd * USD_TO_THB
    return round(min_price_usd, 2), round(min_price_thb, 0)

# ============================================================
# RUN AND PRINT RESULTS
# ============================================================

print("=" * 80)
print("OPERIS — DEAL PROFITABILITY STRESS TEST")
print("COGS per location per month: ${:.2f}".format(COGS_PER_CUSTOMER_USD))
print("=" * 80)

results = [calculate_deal(d) for d in deals]

# --- Per Deal Summary ---
print("\n DEAL-BY-DEAL PROFITABILITY\n")
print(f"{'Deal':<35} {'Locs':>4} {'Monthly $':>10} {'COGS $':>8} {'GP $':>8} {'Margin':>7} {'Profitable':>11}")
print("-" * 90)

for r in results:
    profitable_str = "YES" if r["profitable"] else "LOSING MONEY"
    print(f"{r['name']:<35} {r['locations']:>4} {r['monthly_fee_usd']:>10,.2f} "
          f"{r['monthly_cogs_usd']:>8,.2f} {r['monthly_gross_profit']:>8,.2f} "
          f"{r['monthly_gross_margin_pct']:>6.1f}% {profitable_str:>11}")

# --- Detailed view for each deal ---
print("\n\n DETAILED DEAL BREAKDOWN\n")
for r in results:
    status = "PROFITABLE" if r["profitable"] else "LOSS-MAKING — DO NOT OFFER"
    print(f"{'─'*60}")
    print(f"  {r['name']} — {status}")
    print(f"  Locations: {r['locations']}")
    print(f"  Monthly revenue: ${r['monthly_fee_usd']:,.2f} (B{r['monthly_fee_thb']:,})")
    print(f"  Monthly COGS: ${r['monthly_cogs_usd']:,.2f}")
    print(f"  Monthly gross profit: ${r['monthly_gross_profit']:,.2f}")
    print(f"  Gross margin: {r['monthly_gross_margin_pct']}%")
    print(f"  Setup fee: ${r['setup_fee_usd']:,.2f}")
    print(f"  Onboarding cost recovery: {r['months_to_recover_onboarding']} months")
    print(f"  Full contract value: ${r['total_contract_revenue']:,.2f}")
    print(f"  Full contract profit: ${r['total_contract_profit']:,.2f}")
    print(f"  ARR contribution: ${r['arr']:,.2f}")
    print(f"  Notes: {r['notes']}")

# --- Minimum Price Floor ---
print(f"\n\n MINIMUM PRICE FLOORS (60% gross margin target)\n")
print(f"{'Deal Type':<15} {'Locations':>10} {'Min USD/loc':>12} {'Min THB/loc':>12}")
print("-" * 55)
for deal_type in ["smb", "chain", "enterprise"]:
    for locs in [1, 5, 10, 20, 60]:
        min_usd, min_thb = minimum_price(deal_type, locs)
        print(f"{deal_type:<15} {locs:>10} {min_usd:>12,.2f} {min_thb:>12,.0f}")

# --- Revenue scenario if you close specific deals ---
print(f"\n\n SCENARIO: Close these 3 enterprise deals\n")
scenario_deals = [
    {"name": "Health Land (8 locations)", "locations": 8,
     "monthly_thb_per_loc": 3200, "type": "chain"},
    {"name": "Dental group (5 clinics)", "locations": 5,
     "monthly_thb_per_loc": 3500, "type": "chain"},
    {"name": "Let's Relax (60 locations)", "locations": 60,
     "monthly_thb_per_loc": 2500, "type": "enterprise"},
]

total_mrr = 0
total_cogs = 0
for s in scenario_deals:
    efficiency = 0.92 if s["type"] == "chain" else 0.85
    mrr_usd = (s["locations"] * s["monthly_thb_per_loc"]) / USD_TO_THB
    cogs_usd = COGS_PER_CUSTOMER_USD * s["locations"] * efficiency
    gp = mrr_usd - cogs_usd
    margin = (gp / mrr_usd) * 100
    total_mrr += mrr_usd
    total_cogs += cogs_usd
    print(f"  {s['name']}")
    print(f"    MRR: ${mrr_usd:,.2f} | COGS: ${cogs_usd:,.2f} | GP: ${gp:,.2f} | Margin: {margin:.1f}%\n")

total_gp = total_mrr - total_cogs
total_margin = (total_gp / total_mrr) * 100
print(f"  COMBINED:")
print(f"  Total MRR: ${total_mrr:,.2f}")
print(f"  Total COGS: ${total_cogs:,.2f}")
print(f"  Total Gross Profit: ${total_gp:,.2f}")
print(f"  Blended Gross Margin: {total_margin:.1f}%")
print(f"  ARR: ${total_mrr * 12:,.2f}")

print("\n" + "=" * 80)
print("KEY QUESTION: Is every deal above profitable? If any show LOSS adjust pricing.")
print("Rule: Never go below 55% gross margin. Target 65%+ on enterprise.")
print("=" * 80)
