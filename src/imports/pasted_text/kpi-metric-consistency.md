# Prompt 37 - Make KPI Values Respect Metric Selection (Dollars vs PPD)

You are still in STRICT EXECUTION MODE.

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change the meaning of the existing metric control.  
Do not leave KPI labels and KPI values in different metric systems.  

This is a metric-consistency and rendering-correctness pass only.

## Objective

Ensure that when the user switches between **Dollars** and **PPD**, the **KPI values** change consistently with the selected metric, not just the KPI labels.

Right now the labels change to `(PPD)`, but the displayed KPI values remain dollar values. That is incorrect.

## Core Rule

The KPI layer must use the same metric system as the table for the current scoped dataset.

That means:

- **Metric = Dollars**
  - KPI values must display dollar-based values

- **Metric = PPD**
  - KPI values must display PPD-based values

The KPI layer and the table must always be in the same metric context.

## Changes to Implement

### 1. Apply Metric Transform to KPI Values

Ensure the KPI values for:

- Total Budget
- Total Consumed
- Total Variance
- Variance %

are derived in the active metric context.

If the table is showing PPD values, the KPI cards must also show PPD values for that same scoped dataset.

Do not only relabel the KPI cards.

---

### 2. Use the Same Scoped Data Path as the Table

The KPI layer must use the same scoped and transformed dataset as the current table state for the active view context, including:

- breadcrumb scope
- Pivot By
- Timeframe
- Breakdown By
- Spend Mode
- Metric

Do not let KPI values remain in a pre-transform dollar state while the table is post-transform PPD.

---

### 3. Preserve Percent Logic Appropriately

Ensure Variance % remains mathematically consistent with the active metric context.

Do not allow:
- dollar-derived percent with PPD values
- or PPD-derived values with stale dollar percent

The KPI percentage must remain aligned with the same transformed KPI inputs.

---

### 4. Keep Dollars Behavior Correct

When Metric = Dollars:

- KPI values must remain dollar-based
- labels should not include `(PPD)`
- existing dollar behavior must remain correct

---

### 5. Keep PPD Behavior Correct

When Metric = PPD:

- KPI values must be PPD-based
- KPI labels should include `(PPD)` where appropriate
- values must reconcile with the visible scoped table data in PPD mode

---

### 6. Fix Both Top-Level and Drill Views

Apply this correction consistently across:

- top-level views
- Facility drill
- GL drill
- Vendor drill
- Transactions drill

Do not fix only one screen.

---

### 7. Preserve Existing UI Structure

Do not change:

- KPI layout
- control bar
- breadcrumb
- table layout
- drill interaction
- sorting/filtering
- sticky/scroll behavior

This is a correctness fix, not a redesign.

## Preserve

- Existing visual design
- Existing interaction model
- Existing payload contract
- Existing drill model
- Existing sort and filter behavior
- Existing sticky and overflow behavior
- Existing spend mode behavior

## Output

Respond with exactly these sections:

1. Source of the KPI metric mismatch
2. What was corrected in the data / transformation path
3. What was corrected in KPI rendering
4. Confirmation that Dollars and PPD now both render correctly in KPI and table together
5. Confirmation that drill views were also corrected
6. Confirmation that no layout, structure, or interaction behavior was changed

Do not propose next steps.  
Stop after reporting changes.