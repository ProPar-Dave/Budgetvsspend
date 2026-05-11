# Prompt 36 - Fix Cross-Level Reconciliation and Enforce Calculation Integrity Across Drill

You are still in STRICT EXECUTION MODE.

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change the user-facing interaction model of drill.  
Do not treat each drill level as an independent mock.  
Do not hardcode disconnected totals per screen.  

This is a data integrity, reconciliation, and rendering correctness pass.

## Objective

Fix the prototype so that all values reconcile correctly across drill levels and reflect the governed calculation model already established for the Budget vs Spend surface.

The prototype currently shows disconnected numbers across:

- KPI layer
- Facility rows
- GL rows
- Vendor rows
- Transaction rows

This is incorrect.

Drill must behave as progressive narrowing of the same analytical surface.  
That means the numbers must stay mathematically connected from screen to screen.

## Core Rule

A drilled screen must represent a governed subset or decomposition of the parent screen, not a separate invented dataset.

## Required Integrity Rules

### 1. Parent to Child Reconciliation

For the same active context:

- Timeframe
- Breakdown By
- Metric
- Spend Mode
- Pivot path / breadcrumb scope

the following must hold:

#### Facility level
A Facility row must reconcile to the GL Account rows shown after drilling into that Facility.

#### GL level
A GL Account row must reconcile to the Vendor rows shown after drilling into that GL Account.

#### Vendor level
A Vendor row must reconcile to the Transaction rows shown after drilling into that Vendor.

#### KPI layer
The KPI layer must reconcile to the currently displayed scoped dataset, not to a disconnected mock.

---

### 2. Same Facts, Narrower Scope

When drilling:

- do not swap to a separate fake dataset
- do not invent unrelated numbers
- do not reset values to a new scenario

Instead, the child view must be derived from the same underlying source facts, filtered to the narrower scope defined by the breadcrumb.

---

### 3. Budget, Spend, Variance, and Percent Must Stay Connected

For every drill level, ensure:

- Budget is derived from the correct scoped budget values
- Spend is derived from the correct scoped spend values
- Variance is derived from Budget and Spend according to the established model
- Percent is derived consistently from the same scoped values

Do not allow:
- parent spend = 595 while child rows sum to something else
- parent KPI values that do not match visible child rows
- vendor totals that do not match transaction totals

---

### 4. PPD Must Not Be Independently Mocked Per Screen

If Metric = PPD:

- do not hardcode separate PPD values at each drill level
- derive PPD consistently from governed scoped spend and census context
- preserve the same underlying factual lineage across levels

The child screen must not look numerically plausible while being disconnected from the parent.

---

### 5. Time Bucket Integrity

For periodized views:

- each level must reconcile within the active time bucket context
- child rows must roll up to the parent row for the same period or Full Timeframe scope
- do not let time-bucketed child values drift from their parent values

If Breakdown By = Full Timeframe:
- child totals must reconcile to the parent Full Timeframe row

If Breakdown By is bucketed:
- the parent row for a given period must reconcile to child rows for that same period

---

### 6. Spend Mode Integrity

Respect the established mode rules:

- Actual = invoiced spend
- Commitment = open PO spend not yet realized
- Total Impact = Actual plus open Commitments without double counting

The same mode logic must hold at:
- KPI layer
- parent rows
- drilled rows
- transaction rows

Do not let one level use a different interpretation than another.

---

### 7. Exclusion Integrity

Where exclusions exist:

- excluded rows remain visible
- excluded rows do not contribute budget impact
- exclusion behavior propagates consistently into drill
- parent and child views must reconcile with exclusions applied consistently

Do not let exclusion handling differ between screens.

---

### 8. One Source of Truth Through the Data Layer

Use the prepared architecture correctly:

- database-backed facts or database-shaped seed records
- transformation layer
- repository / adapter
- ReportView payload
- UI rendering

Do not let each drill screen consume independent ad hoc stubs.

The same underlying facts must drive all drill levels.

---

## Required Implementation Approach

### 1. Audit the current drill data path

Identify where disconnected drill values are being introduced, including any of the following if present:

- separate seed blobs per drill screen
- view-specific overrides
- mock KPI values disconnected from row values
- child views not derived from parent scope
- UI-side transformations that break lineage

---

### 2. Rebuild drill views from scoped facts

Refactor the data path so drilled views are derived from the same underlying facts as their parent view, filtered and aggregated by scope.

Examples:

- Facility -> GL view should be built from rows belonging to that Facility
- GL -> Vendor view should be built from rows belonging to that GL
- Vendor -> Transactions view should be built from rows belonging to that Vendor

---

### 3. Enforce reconciliation checks in the data layer

Add deterministic reconciliation checks in the stubbed database/data interface so the prototype can verify:

- parent row equals sum of child rows for the scoped level
- KPI values equal the scoped dataset shown
- transaction totals equal vendor totals
- vendor totals equal GL totals
- GL totals equal facility totals

These checks can be internal and do not need to be surfaced in the UI yet.

---

### 4. Correct the seeded data or derived aggregation logic

If the issue is in the underlying seeded facts, correct the seeded data.

If the issue is in the aggregation / transformation layer, correct the transformation logic.

If both are wrong, correct both.

Do not patch the UI with manual overrides.

---

### 5. Keep the UI rendering faithful to the corrected data layer

Once the data layer is reconciled:

- ensure the UI renders the corrected values exactly
- do not leave stale hardcoded values in the breadcrumb, KPI, or table rows
- do not allow the UI to display values that differ from the data interface results

---

## Preserve

- Existing control bar
- Existing breadcrumb structure
- Existing drill interaction model
- Existing table structure
- Existing column layout
- Existing sticky behavior
- Existing filter and sort behavior
- Existing visual styling
- Existing overlay behavior

This is a correctness pass, not a redesign pass.

## Output

Respond with exactly these sections:

1. Source of the mismatch
2. What was corrected in the data layer
3. What was corrected in the transformation / repository layer
4. What was corrected in UI binding
5. Reconciliation proof across these levels:
   - KPI to current scope
   - Facility to GL
   - GL to Vendor
   - Vendor to Transactions
6. Confirmation that PPD, Spend Mode, and exclusion logic remain aligned with the established calculation model
7. Confirmation that no layout, structure, or interaction behavior was changed

Do not propose next steps.
Stop after reporting changes.