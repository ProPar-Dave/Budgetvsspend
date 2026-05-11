# Prompt 12 - Make Control Bar Wrap Before Collision

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a layout containment refinement only.  
Do not change control contents, labels, option values, control styling, or interaction behavior.

---

## Objective

Ensure the control bar wraps cleanly before controls collide with each other or with the viewport boundary.

This control bar includes a right-anchored section, so wrapping behavior must account for both:
- collision between controls
- collision with the viewport edge while preserving the right-anchored section

---

## Changes to Implement

### 1. Enable Clean Wrapping for the Control Bar

Update the control bar layout so controls wrap onto a new row when horizontal space is no longer sufficient.

Wrapping must occur before:
- controls overlap each other
- controls clip into each other
- controls run into the viewport boundary
- controls visually compress beyond their intended width

---

### 2. Respect Right-Anchored Section

This control bar includes a right-anchored section.

The wrapping logic must account for that anchored section so that left-side controls wrap before colliding with:
- the right-anchored controls
- the viewport boundary

Do not allow left and right sections to overlap or visually compete for the same horizontal space.

---

### 3. Preserve Control Integrity

Each control must preserve:
- its current label
- its current field width unless wrapping is required by the existing layout rules
- its internal spacing
- its dropdown affordance
- its visual styling

Do not squeeze controls into unreadable widths to avoid wrapping.  
Wrap instead.

---

### 4. Preserve Existing Alignment Intent

Keep the existing control bar organization and grouping intent.

This is not a reordering pass.  
Only refine the responsive wrapping behavior so the bar remains readable and stable in narrower widths.

---

### 5. Preserve Vertical Rhythm After Wrap

When controls wrap onto a new row:

- maintain consistent spacing between wrapped rows
- maintain clear alignment
- avoid cramped stacking
- keep the control bar visually coherent as a single system

Do not introduce uneven gaps or irregular row spacing.

---

## Preserve

- Existing control labels and values
- Existing control styling
- Existing control order
- Existing right-anchored section
- Existing page structure
- Existing breadcrumb and context line
- Existing KPI row
- Existing table structure and behavior
- All logic and interactions outside this control bar wrapping refinement

---

## Output

Respond with:

1. Confirmation that control bar elements now wrap before colliding with each other or the viewport boundary  
2. Confirmation that the right-anchored section was preserved and respected in the wrap behavior  
3. Confirmation that control contents, styling, and order were preserved  
4. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.