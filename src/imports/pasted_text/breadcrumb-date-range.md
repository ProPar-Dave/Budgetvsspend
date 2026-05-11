# Prompt 22 - Show Resolved Date Range in Breadcrumb for Full Timeframe

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a labeling and context clarity correction only.

---

## Objective

When **Breakdown By = Full Timeframe**, the breadcrumb/context line must display the **resolved start and end dates of the selected Timeframe**, not the label "Full Timeframe".

---

## Changes to Implement

### 1. Replace "Full Timeframe" with Actual Date Range

When:

- Breakdown By = Full Timeframe  
- AND a predefined Timeframe is selected (e.g., Quarter to Date, Year to Date, Last 12 Months)

Then the breadcrumb must display:

[Start Date] - [End Date]

Example:

Facilities | Jan 1, 2026 - Mar 20, 2026

---

### 2. Resolve Dates from Timeframe Selection

The system must compute and display:

- the correct start date for the selected timeframe
- the current/end date based on system date or selected context

Examples:

- Quarter to Date → Jan 1, 2026 - Mar 20, 2026  
- Year to Date → Jan 1, 2026 - Mar 20, 2026  
- Last 12 Months → Mar 21, 2025 - Mar 20, 2026  

---

### 3. Apply Only When Breakdown By = Full Timeframe

This rule applies ONLY when:

Breakdown By = Full Timeframe

For all other breakdown modes:
- continue using existing formatting rules (Monthly, Weekly, etc.)

---

### 4. Preserve Custom Range Behavior

If the timeframe is already a custom range:

- continue displaying the selected custom range as-is
- do not alter formatting

---

### 5. Maintain Existing Format Structure

Preserve the existing structure:

[Scope] | [Time Context]

Only replace the time context value.

---

## Preserve

- Existing control bar
- Existing breadcrumb structure and styling
- Existing timeframe logic
- Existing breakdown behavior
- Existing table and KPI behavior
- All other UI and interactions

---

## Output

Respond with:

1. Confirmation that "Full Timeframe" is replaced with resolved date ranges in the breadcrumb  
2. Confirmation that predefined timeframes correctly resolve to start and end dates  
3. Confirmation that this only applies when Breakdown By = Full Timeframe  
4. Confirmation that custom ranges remain unchanged  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.