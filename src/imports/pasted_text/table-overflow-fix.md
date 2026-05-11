# Prompt 10 - Add Dedicated Horizontal Scrollbar and Fix Sticky Header Collision in Overflow

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is an overflow behavior and containment refinement only.  
Do not change table columns, data, KPI content, control bar behavior, drill behavior, or formatting rules.

---

## Objective

When the table overflows horizontally:

1. Provide a dedicated horizontal scrollbar that is **40px tall** and easy to grab and scrub  
2. Fix the visual collision between the **sticky** and **non-sticky** header regions during horizontal overflow

---

## Changes to Implement

### 1. Add Dedicated Horizontal Scrollbar for Table Overflow

When the table content exceeds the available horizontal width:

- show a dedicated horizontal scrollbar for the table region
- make the scrollbar area **40px tall**
- ensure it is visually easy to see, grab, and scrub
- keep the scrollbar associated with the table content, not the full page

This scrollbar is for the table overflow region only.

---

### 2. Scrollbar Containment

The horizontal scrollbar must belong to the table container.

It must:
- scroll the overflowing table columns horizontally
- remain aligned with the table width/container
- not feel like a browser/page-level scrollbar
- be easy for the user to discover and interact with

---

### 3. Preserve Sticky Column Behavior During Horizontal Scroll

Preserve the existing sticky first-column behavior.

The sticky column must remain pinned while the non-sticky table region scrolls horizontally.

Do not change sticky logic beyond what is required to correctly support overflow.

---

### 4. Fix Sticky / Non-Sticky Header Collision

Resolve the collision visible between the sticky and non-sticky header regions when horizontal overflow occurs.

The sticky header area and scrolling header area must render cleanly without overlap, clipping, doubled borders, or visual collision.

This includes:
- header edge alignment
- divider treatment
- z-index/layering correctness
- containment so sticky and scrolling regions feel like one coherent table

---

### 5. Preserve Existing Sticky Divider Intent

Do not change the intentional sticky-divider treatment on the right edge of the first column except where minimal adjustment is required to eliminate the overflow collision.

Preserve the established visual intent of the sticky first-column boundary.

---

### 6. Preserve Existing Header Content and Controls

Do not move or redesign:
- header labels
- filter controls
- sort icons
- column adjusters

Only fix their containment and interaction within the overflow scenario as needed.

---

## Preserve

- Existing control bar
- Existing breadcrumb and context line
- Existing KPI row
- Existing table structure
- Existing column order and widths
- Existing sticky first-column behavior
- Existing Period column behavior
- Existing PPD Census behavior
- Existing row styling, hover behavior, and status colors
- Existing resizing behavior
- Existing sorting and filtering behavior
- All logic and interactions outside this overflow and collision refinement

---

## Output

Respond with:

1. Confirmation that the table now has its own horizontal scrollbar in overflow scenarios  
2. Confirmation that the scrollbar is 40px tall and easy to grab and scrub  
3. Confirmation that the sticky/non-sticky header collision was resolved  
4. Confirmation that sticky first-column behavior was preserved  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.