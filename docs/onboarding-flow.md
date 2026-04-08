# Onboarding Flow

**Status: Not yet designed or implemented.**

This document is a placeholder. The onboarding flow has not been defined. The steps below are a skeleton of what needs to be decided and built.

---

## What Needs to Be Defined

1. **How does a new business sign up?**
   - Via a web form? A direct API call? A CLI script?
   - Who initiates onboarding — the business owner or an Operis admin?

2. **What data is collected at signup?**
   - Business name, owner name, contact email, phone number?
   - What Twilio number gets assigned to them?

3. **What gets written to Supabase?**
   - Which tables are created or written to during onboarding?
   - In what order?

4. **What external APIs are called?**
   - Does Twilio number provisioning happen automatically?
   - Is a Vapi assistant created per business?

5. **What does success look like?**
   - What does the business receive (confirmation email, credentials, etc.)?

---

## Planned Sequence (To Be Filled In)

### Step 1 — Business submits registration
- **User sees:** [not defined]
- **Backend does:** [not defined]
- **Supabase writes:** [not defined]
- **External APIs called:** [not defined]

### Step 2 — Phone number assignment
- **Backend does:** [not defined — Twilio provisioning?]
- **Supabase writes:** [not defined]

### Step 3 — Vapi assistant configuration
- **Backend does:** [not defined]
- **Supabase writes:** [not defined]

### Step 4 — Confirmation
- **User sees:** [not defined]
- **Backend does:** [not defined]

---

## Dependencies

- Supabase connection (not yet implemented)
- Twilio account and number provisioning (not yet implemented)
- Vapi assistant creation (not yet implemented)
