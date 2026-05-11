# Prompt 3 - Introduce Period Column (Stacked Time Model)

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

Do not convert the table into a pivoted multi-column time layout.  
Do not create additional tables, cards, or grouped containers.  
Do not collapse or expand rows beyond what is explicitly defined below.

---

## Objective

Introduce a **Period column** into the existing table to represent time buckets as stacked rows.

This is a **data presentation change only**.  
The table must remain a single, flat, scrollable analytical surface.

---

## Changes to Implement

### 1. Add Period Column

Insert a new column labeled:

Period

Position:
- Immediately after the first column (entity column: Facility, GL Account, or Vendor depending on pivot)

Example:

Facility | Period | Budget | Spend | Variance | %

---

### 2. Populate Period Values

Populate the Period column based on current control state:

#### Case 1: View By = Monthly
Use month labels.

Examples:
- Jan 2025
- Feb 2025
- Mar 2025

#### Case 2: View By = Weekly
Use week start date labels.

Examples:
- Jan 1, 2025
- Jan 8, 2025
- Jan 15, 2025

#### Case 3: View By = Full Timeframe
Do not show the Period column.  
In this case, preserve the existing aggregate table structure.

---

### 3. Render Time Buckets as Stacked Rows

When View By is Monthly or Weekly, represent time by repeating the entity row across generated periods.

Example:

North Ridge | Jan 2025 | ...
North Ridge | Feb 2025 | ...
North Ridge | Mar 2025 | ...

Do not pivot time into separate columns.  
Do not create subrows, accordion groups, or nested layouts.  
Keep the table as a single flat list of rows.

---

### 4. Add Filter Control to Period Column Header

Add the same filter/select affordance used in other table headers to the Period column header.

The Period column filter must appear in the same place and follow the same visual pattern as the existing search/filter controls used by the other columns.

Filter options must be derived from the currently generated periods for the active Timeframe + View By combination.

Examples:
- All
- Jan 2025
- Feb 2025
- Mar 2025

or

- All
- Jan 1, 2025
- Jan 8, 2025

---

### 5. Period Filter Behavior

When a single Period value is selected:

- Keep the Period column visible
- Keep the table structure unchanged
- Filter the dataset to rows belonging only to the selected Period
- Show the repeated selected Period value in the Period column for each visible row

Example:

North Ridge | Jan 2025 | ...
Pine Grove | Jan 2025 | ...
Cedar Falls | Jan 2025 | ...

Do not hide the Period column when filtered.  
Do not move the selected Period anywhere else in the table.

---

### 6. Use Existing Table Styling and Behavior

The Period column must inherit the existing table system.

Match existing:
- header styling
- cell styling
- filter control placement
- hover behavior
- row selection behavior
- sort/filter affordances if already present in the system

Do not introduce a special visual treatment for the Period column beyond what is necessary to match the existing filter pattern.

---

## Preserve

- Control bar structure and behavior
- Breadcrumb and breadcrumb context behavior from Prompt 2
- KPI row
- Existing table styling and spacing
- Existing column behavior outside of adding Period
- Existing drill model
- Existing analytical hierarchy
- All logic and interactions outside the Period column addition

---

## Output

Respond with:

1. What was changed to introduce the Period column  
2. How Period values are rendered for Monthly, Weekly, and Full Timeframe  
3. Confirmation that the Period filter uses the same header pattern as the other columns  
4. Confirmation that no other layout, structure, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.