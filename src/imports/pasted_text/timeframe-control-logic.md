You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not modify any controls other than what is explicitly described.
Do not change layout, styling, or behavior beyond what is required.

You are now activating the Timeframe control.

OBJECTIVE

Make the Timeframe control functional so the report can switch between:

- Month to Date
- Full Month
- Quarter to Date

This change must affect:
- KPI values
- table values
- displayed control value

It must NOT affect:
- drill structure
- dataset switching
- breadcrumb
- scope label
- other controls

Do not implement Custom Range in this step.

CHANGES TO IMPLEMENT

1. ACTIVATE TIMEFRAME CONTROL

Convert the Timeframe control from display-only into a simple toggle cycling through these three values in this exact order:

- Month to Date
- Full Month
- Quarter to Date

Default:
- Month to Date

Requirements:
- clicking advances to the next value
- after Quarter to Date, cycle back to Month to Date
- no dropdown
- no additional options

2. ADD TIMEFRAME STATE

Add a new state:

timeframe: "monthToDate" | "fullMonth" | "quarterToDate"

Default:
- "monthToDate"

This state must be accessible to:
- KPI calculations
- table rendering
- control display

3. DEFINE TEMPORARY TIMEFRAME TRANSFORMATIONS

For this prototype only, apply these exact timeframe multipliers to the row values before metric transformation:

- Month to Date:
  - multiplier = 1.0

- Full Month:
  - multiplier = 1.25

- Quarter to Date:
  - multiplier = 3.0

Apply the multiplier to:
- budget
- consumedDisplay
- remaining
- variance

Use the currently displayed spend-mode-adjusted values as the baseline before applying the timeframe multiplier.

Do not explain this logic in the UI.

4. ORDER OF TRANSFORMATION

For this prototype, apply transformations in this exact order:

1. start from source dataset
2. apply Spend Mode transformation
3. apply Timeframe multiplier
4. apply Metric transformation if metric === "ppd"

This order must apply consistently to:
- table values
- KPI values

Variance % remains relative and should not be altered by the metric transformation.
Variance % may remain based on the transformed displayed row values.

5. APPLY TIMEFRAME TO ALL LEVELS

The selected timeframe must affect:
- LEVEL_0 dataset display
- LEVEL_1 dataset display
- LEVEL_2 dataset display
- LEVEL_3 dataset display
- KPI summaries for the active level

Do not change the underlying source datasets.
Apply the transformation only for display/rendering and summary purposes.

6. PRESERVE LABELS

Do not change any labels in this step except the displayed Timeframe control value itself.

That means:
- metric-based PPD labels remain as implemented
- table column names stay the same
- KPI labels stay the same

7. EDITABILITY

Keep editability behavior unchanged in structure.

For this prototype step:
- editable cells may continue to show the displayed transformed value if that is how the current implementation works
- do not redesign edit behavior
- do not add warnings
- do not add locking UI

8. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill state
- dataset switching
- breadcrumb
- scope label
- Facility Scope control
- metric toggle behavior
- spend mode behavior
- sorting/filtering behavior
- table structure
- view states
- layout
- styling beyond what is required for the control to display the active value

9. OUTPUT

After implementing, return:

1. TIMEFRAME CONTROL ACTIVATED
2. TIMEFRAME STATE ADDED
3. TABLE VALUE SWITCHING CONFIRMED
4. KPI VALUE SWITCHING CONFIRMED
5. TRANSFORMATION ORDER CONFIRMED
6. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.