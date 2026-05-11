# Prompt 27 - Consolidate PO and Invoice into Transactions Column

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change calculation logic.  
Do not introduce grouping or nesting.  

This is a table structure simplification and data presentation refinement.

---

## Objective

Replace the separate **PO** and **Invoice** columns with a single **Transactions** column that clearly and compactly communicates:

- PO reference
- Invoice reference
- Missing states (No Invoice / No PO)

The goal is to improve scanability while preserving clarity of source.

---

## Changes to Implement

### 1. Remove Separate PO and Invoice Columns

Remove:

- PO column  
- Invoice column  

Do not leave empty space or placeholders.

---

### 2. Use Transactions Column as Source Identifier

The **Transactions** column must now display:

- PO reference
- Invoice reference
- or both

All within the same cell.

---

### 3. Display Format

Use a compact, single-line format.

#### Case A: PO + Invoice exist

Display:

PO 2001 • Invoice 1001

Both should be visually distinguishable (e.g., link styling if already supported)

---

#### Case B: PO exists, no Invoice

Display:

PO 2003 • No Invoice

---

#### Case C: Invoice exists, no PO

Display:

No PO • Invoice 1004

Only include if this scenario is supported.

---

#### Case D: Neither exists (rare / fallback)

Display:

No PO • No Invoice

---

### 4. Link Behavior

If linking is already supported in the system:

- PO text should link to PO detail
- Invoice text should link to Invoice detail

If linking is not supported, preserve current text styling.

Do not introduce new navigation patterns.

---

### 5. Preserve Compactness

- Keep everything on a single line
- Do not stack values vertically
- Do not introduce badges or chips
- Do not increase row height

This column must remain highly scannable.

---

### 6. Align Stubbed Data

Ensure stubbed data supports:

- PO present / absent
- Invoice present / absent

Display must map directly to data:
- null → “No PO” or “No Invoice”
- value → rendered identifier

Do not hardcode values.

---

### 7. Preserve All Other Table Behavior

Do not change:

- Period column
- Budget / Spend / Variance columns
- Status logic
- Sorting and filtering behavior
- Row styling and coloring
- Drill behavior

---

## Preserve

- Existing control bar
- Existing breadcrumb and context
- Existing KPI row
- Existing table structure outside this change
- Existing formatting rules
- Existing interactions
- All calculation logic

---

## Output

Respond with:

1. Confirmation that PO and Invoice columns were removed  
2. Confirmation that Transactions column now displays PO and Invoice together  
3. Confirmation that missing states show “No Invoice” or “No PO” correctly  
4. Confirmation that formatting is compact and single-line  
5. Confirmation that stubbed data aligns with display  
6. Confirmation that no calculation logic was changed  
7. Confirmation that no other layout, structure, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.