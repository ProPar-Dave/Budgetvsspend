# Prompt 17 - Fix Body Sticky Column (First Column Not Actually Sticky)

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a sticky column correctness fix only.  
Do not change column order, widths, virtualization strategy, or scroll behavior except where required to correctly implement sticky.

---

## Objective

Ensure the **first column in the table body is truly sticky**, matching the behavior of the header.

Currently, the header cell is sticky, but the body cells are not correctly pinned.

---

## Changes to Implement

### 1. Apply Sticky to Actual Body Cells (Not Wrapper)

Ensure the **first column cells in every row**:

- use `position: sticky`
- use `left: 0`
- are not relying on a parent wrapper for stickiness

Sticky must be applied directly to the rendered cell element.

---

### 2. Ensure Sticky Works With Virtualization

If rows are rendered inside a container using transforms (e.g. `translateY`):

- ensure the sticky column is NOT inside a transform context that breaks sticky behavior
- adjust containment so sticky positioning still works correctly within the virtualized list

Do not remove virtualization.

---

### 3. Align Header and Body Sticky Column

Ensure:

- header first column and body first column share the same left offset
- widths match exactly
- no horizontal drift occurs

They must behave as a single vertical column.

---

### 4. Fix Layering (Z-Index)

Ensure the sticky body column:

- renders above scrolling columns
- does not allow underlying cells to bleed through
- aligns visually with the header sticky cell

---

### 5. Ensure Solid Background

Sticky body cells must have a solid background so that:

- scrolling content does not show underneath
- the column reads as a fixed surface

---

## Preserve

- Existing control bar
- Existing breadcrumb and context line
- Existing KPI row
- Existing table structure
- Existing column widths and order
- Existing horizontal scroll behavior
- Existing header sticky behavior
- Existing virtualization
- Existing row styling and status colors
- Existing filters, sorting, resizing

---

## Output

Respond with:

1. Confirmation that the first column in the table body is now truly sticky  
2. Confirmation that header and body columns are aligned  
3. Confirmation that virtualization was preserved  
4. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.