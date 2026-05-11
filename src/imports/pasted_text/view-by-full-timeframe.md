# Prompt 6 - Add Full Timeframe Option to View By

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a control and data presentation change only.  
Do not change existing Monthly or Weekly behavior except where required to support the new Full Timeframe option.

---

## Objective

Add a new **Full Timeframe** option to the **View By** control so the user can view a simple list of single objects within the current scope, without stacked time buckets.

---

## Changes to Implement

### 1. Add New View By Option

Add a new option to the existing **View By** dropdown:

Full Timeframe

Do not rename the existing options.  
Do not change the control’s placement or styling.

---

### 2. Full Timeframe Table Behavior

When **View By = Full Timeframe**:

- Show a simple list of single objects in the current scope
- Do not stack rows by time bucket
- Do not show repeated rows for the same object across periods
- Show one row per object in scope

Examples:
- Facility pivot → one row per Facility
- GL Account pivot → one row per GL Account
- Vendor pivot → one row per Vendor

---

### 3. Period Column Behavior

When **View By = Full Timeframe**:

- Do not show the Period column
- Do not show the Period filter in the table header

When **View By = Monthly** or **Weekly**:
- Preserve existing Period column and Period filter behavior

---

### 4. Preserve Timeframe Scope

Full Timeframe must still respect the selected **Timeframe** control.

This means:
- Data remains constrained to the selected reporting span
- The table simply does not partition that span into visible time buckets

Full Timeframe is an aggregate view of the selected Timeframe, not an all-time view.

---

### 5. Breadcrumb Context Behavior

When **View By = Full Timeframe**, update the breadcrumb context line time portion to display:

Full Timeframe

Example:
Vendors within 7200 - Medical Supplies | Full Timeframe

Do not change the existing breadcrumb structure or styling.

---

### 6. KPI Behavior

When **View By = Full Timeframe**:

- Preserve the KPI row
- KPIs should reflect the selected Timeframe as a whole
- Do not partition KPIs by period

Do not change KPI layout or styling.

---

### 7. Preserve Existing Monthly and Weekly Behavior

When **View By = Monthly** or **Weekly**:

- Preserve stacked time bucket behavior
- Preserve Period column behavior
- Preserve Period filter behavior
- Preserve all existing formatting and interactions

---

## Preserve

- Control bar layout and styling
- Existing dropdown styling and interaction pattern
- Existing Monthly behavior
- Existing Weekly behavior
- Existing breadcrumb structure
- Existing KPI row layout
- Existing table styling, spacing, sorting, and filtering
- Existing drill model
- Existing PPD Census column behavior
- All logic and interactions outside this Full Timeframe addition

---

## Output

Respond with:

1. Confirmation that Full Timeframe was added to the View By control  
2. Confirmation that Full Timeframe shows one row per object in scope with no stacked time buckets  
3. Confirmation that the Period column is hidden in Full Timeframe and preserved in Monthly and Weekly  
4. Confirmation that the breadcrumb context line shows Full Timeframe in this mode  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.