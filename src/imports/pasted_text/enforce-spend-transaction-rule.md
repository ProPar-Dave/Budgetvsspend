# Prompt 30 - Enforce Transaction Presence for All Spend (Stubbed Data + UI Alignment)

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change calculation logic.  

This is a **data integrity correction and UI alignment update**.

---

## Objective

Ensure the system follows this rule:

**Any row with Spend must have a corresponding Transaction.**

Then ensure the UI accurately reflects the corrected data.

---

## Changes to Implement

### 1. Enforce Data Integrity Rule

In the stubbed data layer:

For every row:

- If **Spend > 0**
  → a valid transaction must exist:
    - PO
    - Invoice
    - or both

- If **no transaction exists**
  → Spend must be **0**

This rule must be applied consistently across all rows.

---

### 2. Correct Existing Stubbed Data

Update the dataset to remove invalid states:

#### INVALID (must not exist)
- Spend > 0 AND Transaction = "No PO • No Invoice"

#### VALID STATES

A. PO + Invoice
- Spend > 0
- Transactions = PO X • Invoice Y

B. PO only (Commitment)
- Spend = 0 OR included depending on mode
- Transactions = PO X • No Invoice

C. Invoice only
- Spend > 0
- Transactions = No PO • Invoice Y

---

### 3. Ensure Period Consistency

For time-based rows (daily, weekly, etc.):

- Each period with Spend must map to at least one transaction
- Do not fabricate duplicate transactions across periods unless already modeled

Maintain realistic variation across periods.

---

### 4. Align Spend Modes with Data

Ensure stubbed data supports:

- **Actual**
  - only rows with Invoice present

- **Commitment**
  - rows with PO and no Invoice

- **Total Impact**
  - combination of both, no duplication

Do not change logic, only ensure data supports it.

---

### 5. UI Must Reflect Data Exactly

Ensure:

- Transactions column always reflects underlying data
- No row displays:
  - Spend > 0 with "No PO • No Invoice"

- Rows with:
  - Spend = 0 and valid PO (commitment)
  → display correctly as "PO X • No Invoice"

---

### 6. Preserve Table Behavior

Do not change:

- column structure
- sorting
- filtering
- status logic
- KPI calculations
- drill behavior

---

## Preserve

- Existing control bar
- Existing breadcrumb and context
- Existing KPI row
- Existing table structure
- Existing formatting rules
- Existing interactions
- All calculation logic

---

## Output

Respond with:

1. Confirmation that all Spend values now map to valid transactions  
2. Confirmation that invalid states were removed from stubbed data  
3. Confirmation that data supports Actual, Commitment, and Total Impact modes  
4. Confirmation that UI reflects the corrected data accurately  
5. Confirmation that no calculation logic was changed  
6. Confirmation that no other layout, structure, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.