# Prompt 5 - Add Census Column for PPD Mode

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a mode-specific data presentation change only.  
Do not modify Dollar mode behavior.  
Do not change KPI logic, drill logic, or table behavior outside of adding the Census column in PPD mode.

---

## Objective

When the report is in **PPD mode**, add a **Census** column to the table.

This column must support multiple census types in a single cell.

---

## Changes to Implement

### 1. Add Census Column in PPD Mode Only

When **Metric = PPD**, add a column labeled:

Census

Place it in the table with the other pinned summary columns.

When **Metric != PPD**, do not show the Census column.

---

### 2. Single Census Value Display

If only one census value applies for a row, display the number normally.

Example:

534

---

### 3. Multiple Census Value Display

If more than one census value applies for a row, display all census values in the **same Census cell**.

Format each value in parentheses, separated by a space.

Example:

(534) (177)

Do not split multiple census values into separate columns.  
Do not stack them vertically inside the cell.  
Do not add labels directly in the cell.

---

### 4. Tooltip Behavior

Each displayed census number must have its own tooltip.

On hover, the tooltip must identify which census type that number represents.

Example behavior:

- Hover `(534)` → tooltip identifies the first census type
- Hover `(177)` → tooltip identifies the second census type

The tooltip should identify the census type only.  
Do not add extra explanation unless it already exists in the shared tooltip pattern.

---

### 5. Formatting Rules

- Keep all census values in the same column
- Preserve table scanability
- Preserve row height unless existing truncation or tooltip patterns require otherwise
- Match existing table typography and cell styling
- Use the existing tooltip pattern already present in the prototype, if one exists

---

## Preserve

- Dollar mode behavior
- Existing table structure outside this PPD-specific addition
- Existing control bar
- Existing breadcrumb and context behavior
- Existing drill behavior
- Existing Period column behavior
- Existing numeric formatting rules for non-Census columns
- Existing sorting, filtering, spacing, hover, and row styling unless explicitly needed for this column addition

---

## Output

Respond with:

1. Where the Census column was added in PPD mode  
2. How single and multiple census values are displayed  
3. Confirmation that each census value has its own tooltip identifying the census type  
4. Confirmation that Dollar mode was not changed  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.