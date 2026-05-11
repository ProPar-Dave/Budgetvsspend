You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change calculations.
Do not change values.
Do not change layout structure beyond what is required to support explicit option selection in the control bar.
Do not change table behavior.
Do not change breadcrumb behavior.
Do not change KPI behavior.

OBJECTIVE

Change the report controls from cycle-through interaction to explicit selectable controls so users can directly choose the option they want.

This applies to:
- Facility Scope
- Timeframe
- Metric
- Spend Mode

CHANGES TO IMPLEMENT

1. REMOVE CYCLE INTERACTION MODEL

Do not allow any of the four report controls to advance by cycling through values on repeated click.

This means:
- clicking the current control value should no longer simply rotate to the next option

2. REPLACE WITH EXPLICIT SELECTION MODEL

Each control must allow the user to explicitly choose from its valid set of options.

The user should be able to:
- open the control
- see the available options
- choose the exact desired option directly

3. USE THE EXISTING OPTION SETS ONLY

Use these exact option sets:

Facility Scope:
- All Facilities
- North Ridge
- Pine Grove
- Cedar Falls
- Willow Creek
- Maple Terrace

Timeframe:
- Month to Date
- Full Month
- Quarter to Date

Metric:
- Dollars
- PPD

Spend Mode:
- Actual
- Commitment
- Total Impact

Do not add any options.
Do not remove any options.

4. PRESERVE CURRENTLY SELECTED VALUE DISPLAY

The closed/default appearance of each control should still show the currently selected value exactly as it does now.

This step changes the interaction model, not the selected-state display model.

5. KEEP THE CONTROL BAR CLEAN

Use a simple, standard selection pattern.
Acceptable:
- select-style dropdown
- popover list
- menu list anchored to the control

Do NOT use:
- cycling buttons
- segmented controls for large option sets
- modal dialogs
- helper text
- extra labels beyond what already exists

6. PRESERVE EXISTING LOGIC

Changing a selection must still drive the same existing report behavior:
- Facility Scope affects the same scope behavior it already does
- Timeframe affects the same timeframe behavior it already does
- Metric affects the same metric behavior it already does
- Spend Mode affects the same spend mode behavior it already does

Do not change any transformation rules or data logic.

7. PRESERVE CURRENT EMPHASIS MODEL

Keep the existing default vs non-default emphasis behavior in the control bar.

Do not remove:
- stronger emphasis for non-default states
- calmer presentation for default states

8. PRESERVE EVERYTHING ELSE

Do NOT change:
- density controls
- KPI row
- scope line
- breadcrumb
- compact context strip
- table
- row emphasis
- header/body alignment
- page layout beyond enabling explicit selection interaction

9. OUTPUT

After implementing, return:

1. CYCLE INTERACTION REMOVED
2. EXPLICIT SELECTION MODEL ADDED
3. EXISTING OPTION SETS PRESERVED
4. CURRENT VALUE DISPLAY PRESERVED
5. REPORT LOGIC PRESERVED
6. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.