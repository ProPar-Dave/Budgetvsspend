# Prompt 20 - Custom Range Labeling, Re-Entry, and Confirmable Date Selection

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

You MUST use shadcn/ui components.

---

## Objective

Refine the Custom Range behavior so that:

- The selected date range is visible in the Timeframe control
- The control clearly indicates it is a **Custom range**
- The user can re-open and modify the range at any time
- Date selection is always **range-based (From / To)** with an explicit confirmation step

---

## Changes to Implement

### 1. Display Format in Timeframe Control

When a custom range is selected, update the control label to:

Feb 1, 2026 - Mar 20, 2026 (Custom)

Rules:
- Always append **"(Custom)"**
- Use existing system date formatting
- Do not truncate or abbreviate the range

---

### 2. Re-Open Date Picker on Click

When the Timeframe control displays a custom range:

- clicking the control must reopen the **shadcn/ui Calendar (range picker)**
- the previously selected range must be pre-populated

This allows the user to adjust the range at any time.

---

### 3. Enforce Range-Only Selection

The date picker must:

- ALWAYS operate in **range mode (From / To)**
- NEVER allow single-date selection as a final state

Partial selection (only start date) is allowed temporarily during interaction, but cannot be confirmed.

---

### 4. Add Explicit Confirm Button

Add a **Confirm button** inside the date picker popover.

Behavior:
- The user selects a start and end date
- The user must click **Confirm** to apply the range
- The calendar does NOT auto-close on date selection

---

### 5. Confirm Button Rules

- Disabled until both start and end dates are selected
- On click:
  - apply the selected range
  - update the Timeframe control label
  - close the date picker

---

### 6. Cancel / Dismiss Behavior

If the user closes the picker without confirming:

- do NOT update the timeframe
- retain the previously applied range

---

### 7. Preserve Dropdown Entry Point

"Custom Range" remains an option in the dropdown.

Selecting it:
- opens the date picker
- does not immediately apply any range until confirmed

---

## Preserve

- Existing control bar layout and wrapping behavior
- Existing control styling
- Existing dropdown interaction patterns
- Existing predefined timeframe options
- Existing report logic and data behavior
- All other controls and interactions

---

## Output

Respond with:

1. Confirmation that custom ranges display with "(Custom)" appended  
2. Confirmation that clicking the control reopens the date picker with the existing range  
3. Confirmation that selection is always range-based (no single-date final state)  
4. Confirmation that a Confirm button was added and required to apply changes  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.