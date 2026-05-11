# Prompt 31 - Preserve Transaction Lineage Through Time Aggregation

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout or visual structure.  
Do not change calculation logic.  

This is a **data propagation and UI alignment fix**.

---

## Objective

Ensure that when data is aggregated into time buckets (Daily, Weekly, Monthly):

**transaction lineage is preserved and displayed.**

No aggregated row with Spend > 0 may lose its transaction reference.

---

## Changes to Implement

### 1. Fix Aggregation Layer

When building time-bucketed rows:

- each aggregated row must retain a reference to:
  - one or more underlying transactions

Do not allow:

Spend > 0 AND transaction reference = null

---

### 2. Define Display Behavior for Aggregated Rows

If a time bucket contains:

#### A. Single transaction
Display normally:
PO 2001 • Invoice 1001

---

#### B. Multiple transactions
Display a compact aggregated indicator:

Option:
- "Multiple Transactions"

Do NOT list all transactions inline.

---

### 3. Maintain Click Behavior

Clicking a Transactions cell must still:

- open the overlay
- pass context for that period

Optional (if trivial):
- show count of transactions in overlay

---

### 4. Align Stubbed Data + Derived Views

Ensure:

- base dataset = correct (already true)
- derived dataset (time buckets) = ALSO correct

This is where the fix is required.

---

### 5. UI Must Never Show Empty Transactions for Spend Rows

Disallow:

- blank Transactions cell when Spend > 0

Fallback (only if necessary):

- "Multiple Transactions"

---

## Preserve

- Existing table structure
- Existing columns
- Existing formatting
- Existing drill behavior
- Existing stubbed base data
- All calculation logic

---

## Output

Respond with:

1. Confirmation that aggregation now preserves transaction lineage  
2. Confirmation that all Spend rows have valid transaction display  
3. Confirmation that multi-transaction periods display correctly  
4. Confirmation that no calculation logic was changed  
5. Confirmation that no layout or structure was changed  

Do not propose next steps.  
Stop after reporting changes.