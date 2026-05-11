# Prompt 21 - Fix Timeframe Dropdown vs Custom Range Trigger Behavior

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a trigger and interaction logic correction only.

---

## Objective

Ensure the Timeframe control behaves as a standard dropdown first, and only launches the date picker when the user explicitly selects **"Custom Range"**.

---

## Correct Interaction Model

### 1. Clicking the Timeframe Control

When the user clicks the Timeframe control:

- ALWAYS open the **dropdown list of options**
- NEVER immediately open the date picker

This applies even if the current value is a custom range.

---

### 2. Dropdown Options Must Always Be Accessible

The dropdown must always include:

- Month to Date  
- Quarter to Date  
- Year to Date  
- Last 12 Months  
- Custom Range  
- Previously selected custom range (displayed as: Feb 1, 2026 - Mar 20, 2026 (Custom))

The user must always be able to select any preset option without interference.

---

### 3. Triggering the Date Picker

The date picker should ONLY open when:

- the user selects **"Custom Range"** from the dropdown  
OR
- the user selects the existing custom range option (e.g. "Feb 1, 2026 - Mar 20, 2026 (Custom)")

---

### 4. Do NOT Auto-Launch Date Picker

Remove any logic that:

- automatically opens the date picker when the current state is custom
- bypasses the dropdown entirely

This behavior is incorrect and must not occur.

---

### 5. Preserve Confirm-Based Flow

When the date picker is opened:

- it must still require explicit **Confirm**
- no changes are applied until confirmed

---

### 6. Preserve Current Display Behavior

The Timeframe control should continue to display:

Feb 1, 2026 - Mar 20, 2026 (Custom)

But this display must NOT affect how the control opens.

---

## Preserve

- Existing control bar layout and wrapping behavior
- Existing control styling
- Existing dropdown styling and animation
- Existing date picker implementation (shadcn/ui)
- Existing Confirm/Cancel behavior
- Existing report logic and data behavior
- All other controls and interactions

---

## Output

Respond with:

1. Confirmation that clicking the Timeframe control always opens the dropdown  
2. Confirmation that preset options are always accessible  
3. Confirmation that the date picker only opens when "Custom Range" is selected  
4. Confirmation that auto-launch behavior was removed  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.