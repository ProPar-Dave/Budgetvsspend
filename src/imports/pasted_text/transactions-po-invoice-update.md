# Prompt - Transactions Table: PO Column, Invoice Handling, and Stubbed Data Alignment

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change calculation logic.  
Do not introduce backend integration.  
Do not remove existing columns or controls unless explicitly instructed.  

This is a **targeted table structure + data alignment update for the Transactions view only**.

---

## Objective

Make the **source of spend explicit and trustworthy** at the transaction level by:

1. Adding a **PO column**
2. Clearly distinguishing between:
   - Commitments (open POs)
   - Actuals (invoiced spend)
3. Ensuring **stubbed data reflects real-world scenarios**
4. Keeping UI and data fully aligned

---

## Changes to Implement

### 1. Add PO Column

Add a new column labeled:

PO

Position:
- Immediately before the **Invoice** column

Resulting structure example:

PO | Invoice | Period | Budget | Spend | Variance | %

---

### 2. Populate PO Column

For each row:

- If the transaction originates from a Purchase Order:
  - display the PO identifier (e.g., PO 2001)

- If no PO exists:
  - display `--`

---

### 3. Update Invoice Column Behavior

For each row:

- If an invoice exists:
  - display the invoice identifier (e.g., Invoice 1001)

- If no invoice exists:
  - display `--`

---

### 4. Represent Open Commitments Clearly

For rows where:

- PO exists
- Invoice does NOT exist

Display:

PO: [PO Number]  
Invoice: --

This must clearly communicate:
→ this is a commitment (not yet invoiced)

---

### 5. Update Stubbed Data Model

Extend the transaction-level stubbed data to include:

- PO (string or null)
- Invoice (string or null)

Do not remove existing fields.

---

### 6. Populate Stubbed Data with Realistic Scenarios

Ensure the dataset includes:

#### A. Open Commitments (PO only)
- PO: populated (e.g., PO 2001)
- Invoice: null → displayed as `--`

#### B. Realized Spend (PO + Invoice)
- PO: populated
- Invoice: populated

#### C. Invoice Without PO (only if valid in system)
- PO: null → displayed as `--`
- Invoice: populated

Do not invent scenarios that are not supported by the system.

---

### 7. Align Data with Spend Modes

Ensure stubbed data supports:

- **Commitment mode**
  - includes rows where Invoice is not present

- **Actual mode**
  - includes rows where Invoice is present

- **Total Impact mode**
  - includes both, without duplication

Do not modify calculation logic.

---

### 8. Ensure UI Reflects Data Exactly

- PO column must display:
  - value or `--` based on data

- Invoice column must display:
  - value or `--` based on data

Do not hardcode display values.

All UI values must come from the stubbed dataset.

---

### 9. Preserve Flat Table Structure

Do not introduce:

- grouping
- nesting
- hierarchy between PO and Invoice rows

Maintain a flat, scannable table.

---

### 10. Preserve Existing Table Behavior

Do not change:

- control bar
- breadcrumb
- KPI row
- Period column behavior
- PPD Census behavior
- sorting and filtering
- row styling and status coloring
- drill model

---

## Preserve

- All existing UI structure outside this change
- All existing formatting rules
- All existing interactions
- All calculation logic

---

## Output

Respond with:

1. Confirmation that the PO column was added before Invoice  
2. Confirmation that PO and Invoice display correct values or `--`  
3. Confirmation that open commitments are clearly represented  
4. Confirmation that stubbed data includes PO and Invoice fields  
5. Confirmation that realistic data scenarios are represented  
6. Confirmation that mode behavior aligns with the dataset  
7. Confirmation that UI reflects stubbed data consistently  
8. Confirmation that no calculation logic was changed  
9. Confirmation that no other layout, structure, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.