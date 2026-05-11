# Prompt 28 - Make Transactions Clickable with Prototype Boundary Overlay

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not introduce real navigation or backend integration.  

This is an interaction stub only.

---

## Objective

Make all values in the **Transactions column** interactive links that:

- behave like real navigation targets
- but open a **prototype boundary overlay** instead of navigating

---

## Changes to Implement

### 1. Make Transactions Clickable

For every row in the **Transactions column**:

- the entire transaction value (e.g., `PO 2001 • Invoice 1001`) must be clickable
- apply existing link styling if available
- do not change row height or layout

---

### 2. Trigger Overlay on Click

On click:

- open a centered overlay/modal
- do not navigate away from the page
- do not change route or URL

---

### 3. Overlay Content

Display the following message:

**Title:**
Prototype Boundary

**Body:**
Transaction details should appear here.

This interaction is currently stubbed in the prototype.  
In a future iteration, this overlay will display full transaction details, including PO and invoice information.

---

### 4. Overlay Behavior

- include a close action (X or Close button)
- clicking outside the overlay should also dismiss it (if consistent with existing patterns)
- overlay should not affect the underlying table state

---

### 5. Preserve Context (Optional, if trivial)

If easily supported without introducing complexity:

- include the clicked transaction string in the overlay (e.g., PO 2001 • Invoice 1001)

If not trivial, omit.

---

## Preserve

- Existing control bar
- Existing breadcrumb and context
- Existing KPI row
- Existing table structure
- Existing column layout
- Existing formatting rules
- Existing sorting and filtering behavior
- Existing drill model
- Existing stubbed data behavior
- All calculation logic
- All interactions outside this addition

---

## Output

Respond with:

1. Confirmation that all Transactions values are clickable  
2. Confirmation that clicking opens a prototype boundary overlay  
3. Confirmation that no navigation occurs  
4. Confirmation that overlay includes the correct message  
5. Confirmation that no other layout, structure, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.