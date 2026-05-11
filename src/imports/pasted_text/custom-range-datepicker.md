# Prompt 18 - Show Date Picker When "Custom Range" is Selected

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a conditional interaction enhancement only.  
Do not change existing timeframe options, control styling, or control bar layout beyond what is required to support the date picker.

---

## Objective

When the user selects **"Custom Range"** in the Timeframe control, provide a date picker that allows the user to define a start and end date.

---

## Changes to Implement

### 1. Trigger Date Picker on Selection

When the user selects:

Custom Range

Immediately provide a date range selection interface.

This must occur as a direct result of the selection, without requiring additional clicks.

---

### 2. Date Picker Behavior

The date picker must allow:

- selection of a **start date**
- selection of an **end date**

The selected range defines the active timeframe for the report.

---

### 3. Placement

The date picker must appear:

- anchored to the Timeframe control
- in the same interaction pattern as the existing dropdown (popover or overlay)
- without shifting the layout of the page or control bar

Do not introduce page reflow.

---

### 4. Replace or Extend Dropdown State

When "Custom Range" is active:

- either extend the existing dropdown into a date picker state
- or replace the dropdown content with the date picker

Do not create a second, separate control elsewhere on the page.

---

### 5. Display Selected Range

Once a range is selected:

- the Timeframe control must reflect the selected range
- format should match existing system conventions (e.g., Mar 1, 2026 - Mar 20, 2026)

---

### 6. Preserve Existing Options

Keep all existing predefined timeframe options:

- Month to Date
- Quarter to Date
- Year to Date
- Last 12 Months

No changes to their behavior.

---

## Preserve

- Existing control bar layout and wrapping behavior
- Existing labels and styling
- Existing dropdown interaction patterns
- Existing report behavior and data logic
- All other controls and interactions

---

## Output

Respond with:

1. Confirmation that selecting "Custom Range" triggers a date picker  
2. Confirmation that the date picker allows start and end date selection  
3. Confirmation that it is anchored to the Timeframe control without layout shift  
4. Confirmation that the selected range is reflected in the control  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.