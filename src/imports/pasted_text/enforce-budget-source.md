[2026-03-23 17:44:00 UTC | PROMPT | G11 M21] Budget Source of Truth Enforcement

This is correct, and more importantly, it needs to be **codified into the system**, not left as tribal knowledge.

Right now you’ve identified a critical invariant:

> **budgets_daily is the source of truth**
> transactions.amount_budget is contextual only

If this is not enforced, the system will drift and you will reintroduce the exact reconciliation issues you just fixed.

Use this prompt to lock the rule into the system:

```markdown
# Prompt 42 - Enforce Budget Source of Truth (budgets_daily) Across Data Layer and Prevent Drift

You are still in STRICT EXECUTION MODE.

## Constraints

Do not redesign anything.  
Do not change UI layout, structure, or interaction.  
Do not change calculation formulas beyond enforcing correct data sourcing.  
Do not introduce duplicate sources of truth.  

This is a **data contract enforcement and integrity pass**.

---

## Objective

Ensure that **budget values are always sourced from `budgets_daily`** for all aggregation, KPI, and drill-level rollups.

Ensure that `transactions.amount_budget` is treated as:

> **contextual metadata only at the transaction (leaf) level**

and is NEVER used as a source of truth for aggregated budget values.

---

## Core Rule (Non-Negotiable)

- `budgets_daily` = authoritative budget source  
- `transactions.amount_budget` = display-only context  

No aggregation logic may depend on transaction-level budget values.

---

## Changes to Implement

### 1. Enforce Budget Source in Repository Layer

Update all aggregation logic so that:

- Facility-level budget = SUM(budgets_daily.amount)
- GL-level budget = SUM(budgets_daily.amount) filtered by GL
- Vendor-level budget = SUM(budgets_daily.amount) filtered by vendor scope (if applicable)
- KPI budget = SUM(budgets_daily.amount) for current scope

Do NOT derive budget using:

- SUM(transactions.amount_budget)
- any fallback to transaction-level budget fields

---

### 2. Restrict Use of `transactions.amount_budget`

Ensure `transactions.amount_budget` is only used for:

- transaction-level display context
- showing how a specific transaction relates to budget

Do NOT use it for:

- rollups
- KPI calculations
- variance calculations at aggregate levels

---

### 3. Align Variance Calculation

Ensure:

```

variance = budget (from budgets_daily) - actual (from transactions)

```

This must hold consistently at:

- KPI level
- Facility
- GL
- Vendor
- Transaction (where applicable)

---

### 4. Guard Against Silent Drift

Add an internal validation (non-UI) in the repository layer:

For any scoped query:

```

SUM(budgets_daily.amount)
vs
SUM(transactions.amount_budget)

```

If both exist for the same scope:

- log mismatch in development mode
- do not fail UI rendering
- do not use transaction budget as fallback

This is a diagnostic only.

---

### 5. Ensure Transaction-Level Budget Context Still Works

At the transaction level:

- continue displaying `amount_budget` if present
- allow NULL where appropriate (e.g., excluded rows)
- do not attempt to “backfill” missing budget from aggregation

---

### 6. Preserve Exclusion Behavior

Ensure:

- excluded GLs do not contribute budget from `budgets_daily`
- excluded transactions may still show actual spend
- variance is null or appropriately suppressed for excluded rows

---

### 7. Preserve All Existing Behavior

Do not change:

- drill behavior
- KPI layout
- table layout
- control bar behavior
- metric behavior
- spend mode behavior
- PPD behavior (even if temporarily incorrect)
- transformation pipeline structure

---

## Output

Respond with exactly:

1. Where transaction-level budget usage was removed from aggregation logic
2. How budgets_daily is now consistently used across all levels
3. How variance calculation was aligned
4. What validation guard was added for drift detection
5. Confirmation that transaction-level budget context remains intact
6. Confirmation that no UI or interaction behavior changed

Do not propose next steps.  
Stop after reporting changes.
```

---

## Why this matters (brief)

You’ve now drawn a clean boundary:

* **Budget = planned (budgets_daily)**
* **Spend = realized (transactions)**
* **Accruals = modeled spend**
* **Everything resolves at daily grain**

That is exactly what your **Kernel + LST model needs** to stay trustworthy.

---

If you want next step after this, it should be:

**PPD correction (switch from ÷100 → census-driven)**

That’s your next trust-critical fix.
