# Prompt 41 - Validate Supabase Schema Against Budget vs Spend LST and UI Contract

You are now operating as a **data validation engineer**.

The `bvs` schema has been created in Supabase.

Do NOT modify schema in this pass.  
Do NOT modify UI.  
Do NOT assume correctness.

This is a **validation and proof pass only**.

---

## Objective

Prove that the Supabase schema and seed data:

1. mathematically reconcile
2. support the full drill path
3. align with the ReportView contract
4. correctly represent manual accruals
5. support PPD and spend modes

---

## Required Validations

### 1. Reconciliation Validation

For the seeded dataset, explicitly verify:

Facility  
= sum(GL Accounts)

GL Account  
= sum(Vendors)

Vendor  
= sum(Transactions)

For each level validate:
- budget
- actual (spend)
- commitment
- variance

Show the math.

---

### 2. Transaction Integrity

Validate that the transactions table correctly represents:

- PO
- Invoice
- PO + Invoice linkage
- Manual accrual

Confirm:

- no transaction with spend exists without a valid source
- commitment vs actual is correctly derivable
- accruals are indistinguishable structurally from other transactions (except type)

---

### 3. Exclusion Behavior

Validate:

- excluded GL rows exist
- excluded rows:
  - retain spend
  - remove budget impact
- exclusion propagates correctly into child levels

---

### 4. Time + Grain Validation

Validate:

- budgets_daily exists and is populated
- census_daily exists and is populated
- data supports:
  - daily aggregation
  - weekly aggregation
  - full timeframe aggregation

---

### 5. PPD Validation

Validate:

PPD = spend / person-days

Confirm:

- census data joins correctly
- PPD can be derived at:
  - facility level
  - GL level
  - vendor level

---

### 6. Spend Mode Validation

Validate that the schema supports:

- Actual (invoiced spend)
- Commitment (open PO)
- Total Impact (Actual + remaining Commitment)

Confirm:

- no double counting
- correct separation of PO vs Invoice vs Accrual

---

### 7. Contract Alignment

Map the schema to:

DB → Db* types → ReportView

Confirm:

- no missing fields
- no extra required transformations
- no UI-dependent logic required

---

### 8. Drill Path Readiness

Confirm the schema supports:

Facility  
→ GL Account  
→ Vendor  
→ Transaction  

Without:

- data duplication
- shared child datasets
- broken joins

---

## Output

Respond with exactly:

1. Reconciliation proof (with numbers)
2. Transaction model validation
3. Exclusion validation
4. Time + grain validation
5. PPD validation
6. Spend mode validation
7. Contract alignment assessment
8. Drill readiness assessment
9. Any structural risks before wiring into repository

Do not propose schema changes yet.  
Do not modify anything.  
Stop after reporting.