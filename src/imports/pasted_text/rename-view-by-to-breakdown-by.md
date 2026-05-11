# Prompt 7 - Rename View By to Breakdown By and Default to Full Timeframe on Timeframe Change

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not add new UI elements unless explicitly instructed.  
Do not remove existing UI elements unless explicitly instructed.  

This is a labeling and control behavior change only.  
Do not modify table structure, KPI structure, breadcrumb structure, or drill behavior except where required to support the requested control behavior.

---

## Objective

Make two tightly scoped changes:

1. Rename the **View By** control to **Breakdown By**  
2. When the user changes **Timeframe**, automatically set **Breakdown By** to **Full Timeframe** by default

---

## Changes to Implement

### 1. Rename Control Label

Replace the label:

View By

with:

Breakdown By

Apply this label change anywhere this control is presented in the current UI.

Do not rename option values inside the dropdown.  
Only rename the control label.

---

### 2. Default Breakdown By to Full Timeframe on Timeframe Change

When the user changes the **Timeframe** control:

- Automatically set **Breakdown By** to **Full Timeframe**
- This should happen immediately as part of the Timeframe selection change
- The UI should then reflect the existing Full Timeframe behavior already implemented

Examples:
- If Breakdown By was Monthly and the user changes Timeframe, Breakdown By becomes Full Timeframe
- If Breakdown By was Weekly and the user changes Timeframe, Breakdown By becomes Full Timeframe

---

### 3. Preserve Manual User Choice After Timeframe Change

After the Timeframe change sets Breakdown By to Full Timeframe by default:

- The user must still be able to manually change Breakdown By to another option
- Do not remove or restrict the Breakdown By control
- Do not change the available Breakdown By options

---

### 4. Preserve Existing Full Timeframe Behavior

When Breakdown By becomes Full Timeframe through this defaulting behavior, preserve the already established Full Timeframe rules:

- show one row per object in scope
- no stacked time buckets
- no Period column
- breadcrumb context time portion displays Full Timeframe

Do not alter those rules in this prompt.

---

## Preserve

- Existing control bar layout and styling
- Existing Timeframe control styling and interaction pattern
- Existing Breakdown By dropdown styling and option list, other than the label rename
- Existing Monthly behavior
- Existing Weekly behavior
- Existing Full Timeframe behavior
- Existing breadcrumb structure and styling
- Existing KPI layout and behavior
- Existing table styling, spacing, sorting, and filtering
- Existing drill model
- Existing PPD Census column behavior
- All logic and interactions outside this label change and defaulting behavior

---

## Output

Respond with:

1. Confirmation that View By was renamed to Breakdown By  
2. Confirmation that changing Timeframe now defaults Breakdown By to Full Timeframe  
3. Confirmation that users can still manually change Breakdown By after Timeframe changes  
4. Confirmation that existing Full Timeframe, Monthly, and Weekly behaviors were preserved  
5. Confirmation that no other layout, structure, logic, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.