# Prompt 19 - Use shadcn/ui Date Picker for Custom Range Selection

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a component-specific interaction requirement.  
You MUST use shadcn/ui components.

---

## Objective

When the user selects **"Custom Range"** in the Timeframe control, launch a **shadcn/ui Calendar-based Date Range Picker** to capture the timeframe.

---

## Changes to Implement

### 1. Trigger shadcn/ui Date Picker

When the user selects:

Custom Range

Immediately replace the dropdown content with a **shadcn/ui Date Picker (Calendar)** configured for **range selection**.

Do not leave the dropdown as a static selection list.

---

### 2. Component Requirement (MANDATORY)

You MUST use:

- shadcn/ui Calendar component
- configured for **date range selection (start + end)**

Do not build a custom calendar.  
Do not use a different date picker library.

---

### 3. Interaction Model

- The calendar appears as a **popover anchored to the Timeframe control**
- It opens immediately upon selecting "Custom Range"
- The user selects:
  - start date
  - end date

---

### 4. Selection Behavior

Once both dates are selected:

- the calendar closes
- the selected range becomes the active timeframe
- the Timeframe control updates to display:

Feb 1, 2026 - Mar 20, 2026

(format must match existing system formatting)

---

### 5. Preserve Dropdown Context

The dropdown should:

- transition into the date picker state
- not create a second floating UI elsewhere
- remain visually and spatially tied to the Timeframe control

---

### 6. Preserve Existing Options

Keep all predefined timeframe options unchanged:

- Month to Date
- Quarter to Date
- Year to Date
- Last 12 Months

Only "Custom Range" triggers the calendar behavior.

---

## Preserve

- Existing control bar layout and wrapping behavior
- Existing control styling
- Existing dropdown styling and animation patterns
- Existing report logic
- All other controls and interactions

---

## Output

Respond with:

1. Confirmation that selecting "Custom Range" launches a shadcn/ui Calendar  
2. Confirmation that it supports start and end date selection  
3. Confirmation that it is anchored to the Timeframe control  
4. Confirmation that the selected range updates the control label  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.