# Prompt 43 - Decouple KPI from Rows and Enforce Authoritative Budget Source

You are in STRICT EXECUTION MODE.

## Constraints

Do not redesign UI.  
Do not change layout, structure, or interaction.  
Do not modify column definitions, grid behavior, drill behavior, or styling.  
Do not change spend mode, metric, timeframe, or PPD logic.  

This is a **data integrity correction only**.

---

## Objective

Ensure KPI values are **NOT derived from rows** and instead come from an **authoritative budget source** aligned with the future `budgets_daily` model.

---

## Core Rule

- KPI must NOT be computed from `rows[]`
- KPI must come from a **dedicated aggregate source**
- `rows[]` are for display and drill only
- KPI must always represent **true scoped totals**

---

## Changes to Implement

### 1. Remove KPI Derivation from Rows

Locate:

- `computeKpiFromRows()` in `transform.tsx`
- Any usage of:
  ```ts
  rows.reduce(...)
  ``` id="9s0xq1"

Remove KPI derivation logic entirely.

Do NOT compute KPI from row data at any level.

---

### 2. Introduce Authoritative KPI Source

Update the data flow so that:

- KPI is provided directly from the data layer (DbView / seed / future Supabase)
- `assembleReportView()` must set:
  ```ts
  kpi: transformKpi(dbView.kpi)
  ``` id="r4p8zn"

If `dbView.kpi` does not exist, create it in the seed layer.

---

### 3. Update Seed Data to Carry KPI Explicitly

In `db-seed.tsx`:

For every view, ensure:

```ts
DbView {
  kpi: {
    budget,
    consumed,
    variance,
    percent,
    reconciliation: {...}
  }
}
``` id="2n8fks"

Rules:

- KPI must equal the **authoritative scope total**
- Do NOT rely on children summation
- Transaction-level views must inherit KPI from parent scope

---

### 4. Enforce Transaction-Level KPI Behavior

At transaction drill level:

- KPI must NOT be recomputed from transactions
- KPI must represent the **parent scope totals**

Example:

- Facility → GL → Vendor → Transactions
- Transaction view KPI = Vendor totals (not sum of transactions)

---

### 5. Preserve Row-Level Budget Context

Do NOT change:

- `row.budget` at transaction level
- `transactions.amount_budget` usage

These remain:

- display-only
- contextual
- non-authoritative

---

### 6. Add Development Guard (Non-UI)

Inside repository layer:

Add validation:

```ts
if (__DEV__) {
  const derivedBudget = sum(rows.map(r => r.budget))
  if (Math.abs(derivedBudget - kpi.budget) > tolerance) {
    console.warn('[KPI_DRIFT]', { derivedBudget, authoritative: kpi.budget })
  }
}
``` id="g7x2vm"

Rules:

- Do not block rendering
- Do not fallback to derived value
- Logging only

---

### 7. Do Not Change Any UI Binding

Ensure:

- UI continues to read:
  ```ts
  currentView.kpi