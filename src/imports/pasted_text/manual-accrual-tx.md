# Prompt 38A - Represent Manual Accruals in Transactions View and Require Backend/API Contract Support

You are still in STRICT EXECUTION MODE.

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change calculation logic.  
Do not introduce a new navigation pattern.  
Do not treat manual accruals as front-end-only fabricated rows.  

This is a transaction-level representation, overlay messaging, and API contract enforcement pass.

## Objective

Represent **manual accruals** at the **Transactions** level, reuse the existing **prototype boundary overlay** pattern, and ensure that manual accruals are part of the **backend / API contract** so they definitely come from the database-backed data layer.

The goal is:

1. manual accruals must appear as transaction-level records
2. manual accruals must come from the DB-backed payload, not UI invention
3. clicking a manual accrual uses the existing prototype boundary overlay
4. the overlay must explain the type of detail a user should expect there later

## Core Rule

Manual accruals are part of the transaction model and must be represented in the API contract with the backend.

They must not be:
- hardcoded in the UI
- fabricated only in the repository
- derived only from display logic
- implied without explicit data representation

## Changes to Implement

### 1. Add Manual Accruals to the Transaction-Level Data Contract

Ensure the backend-facing / API-facing contract explicitly supports manual accrual transaction records.

Manual accrual records must be part of the data returned from the DB-backed data layer.

At minimum, the transaction contract must be able to distinguish among:
- PO-backed transactions
- Invoice-backed transactions
- Manual accrual transactions

Do not leave manual accruals as an inferred display state.

---

### 2. Add Explicit Transaction Type Support

The transaction-level contract must include an explicit type or equivalent field so the UI can reliably identify a manual accrual row from payload data.

Examples of acceptable modeled states:
- `PO`
- `INVOICE`
- `PO_AND_INVOICE`
- `MANUAL_ACCRUAL`

Exact naming can follow the existing codebase style, but the concept must be explicit in the contract.

Do not rely on string parsing of the Transactions label.

---

### 3. Ensure Manual Accruals Come from the DB-Backed Source

Manual accrual rows shown in the Transactions view must be sourced from:
- database-backed records
- or the database-shaped local seed path that mirrors the future backend contract

The UI must not generate manual accrual rows independently.

The repository / adapter / transformation path must preserve manual accrual records through to the final payload.

---

### 4. Represent Manual Accruals in the Transactions Column

At transaction level, manual accruals must appear in the same Transactions column pattern already used for PO / Invoice entries.

Use a compact single-line format.

Examples of acceptable display patterns:
- Manual Accrual
- Accrual 1001
- Manual Accrual • No Invoice

Do not add a separate accrual column.  
Do not group or nest them.

---

### 5. Preserve Existing Compact Transaction Presentation

Manual accrual transaction entries must remain consistent with the compact Transactions column design already established.

Do not:
- increase row height
- stack text vertically
- add chips or badges
- create a second transaction area in the row

---

### 6. Make Manual Accrual Entries Clickable

Manual accrual entries in the Transactions column must be clickable, using the same interaction pattern as other transaction entries.

On click:
- open the existing prototype boundary overlay
- do not navigate away
- do not change route or URL

---

### 7. Reuse the Existing Prototype Boundary Overlay

Reuse the existing overlay pattern.

Do not create a new modal design.  
Do not create a different interaction model.

---

### 8. Update Overlay Content for Manual Accruals

When the clicked transaction is a manual accrual, the overlay must clearly state that manual accrual detail should appear here in the future.

Use content along these lines:

**Title:**  
Prototype Boundary

**Body:**  
Manual accrual details should appear here.

This interaction is currently stubbed in the prototype.  
In a future iteration, this overlay should display the information needed to understand and manage the accrual entry.

Expected information may include:
- accrual identifier
- description / memo
- amount
- accrual date
- effective budget period
- facility
- GL account
- vendor, if applicable
- source / reason for accrual
- created by
- created date
- last updated date
- current status

Do not imply this detail view is already implemented.

---

### 9. Preserve Existing Overlay Behavior for Other Transaction Types

Do not change the existing overlay behavior for:
- PO + Invoice entries
- PO only entries
- Invoice only entries

Only extend the pattern so manual accruals use the same overlay framework with manual-accrual-specific wording.

---

### 10. Preserve the Data Path Architecture

Manual accrual support must flow through the existing architecture:

database / DB-shaped seed  
→ database-facing records  
→ transformation layer  
→ repository / adapter  
→ payload contract  
→ UI rendering

Do not bypass this path.

---

## Preserve

- Existing control bar
- Existing breadcrumb and context
- Existing KPI row
- Existing table structure
- Existing transaction compact display pattern
- Existing overlay style and dismiss behavior
- Existing sorting and filtering behavior
- Existing drill behavior
- Existing calculation logic
- Existing visual styling

## Output

Respond with exactly these sections:

1. How manual accruals were added to the backend / API contract
2. How manual accruals flow through the data path from DB-backed source to UI
3. How manual accruals are represented in the Transactions column
4. How manual accrual clicks use the existing prototype boundary overlay
5. What manual accrual information the overlay now explains
6. Confirmation that other transaction overlay behavior was preserved
7. Confirmation that no layout, structure, or calculation behavior was changed

Do not propose next steps.  
Stop after reporting changes.