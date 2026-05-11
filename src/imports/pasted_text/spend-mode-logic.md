You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not modify any controls other than what is explicitly described.
Do not change layout, styling, or behavior beyond what is required.

You are now activating the Spend Mode control.

OBJECTIVE

Make the Spend Mode control functional so the report can switch between:

- Actual
- Commitment
- Total Impact

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

CHANGES TO IMPLEMENT

1. ACTIVATE SPEND MODE CONTROL

Convert the Spend Mode control from display-only into a simple toggle cycling through these three values in this exact order:

- Actual
- Commitment
- Total Impact

Default:
- Actual

Requirements:
- clicking advances to the next value
- after Total Impact, cycle back to Actual
- no dropdown
- no additional options

2. ADD SPEND MODE STATE

Add a new state:

spendMode: "actual" | "commitment" | "totalImpact"

Default:
- "actual"

This state must be accessible to:
- KPI calculations
- table rendering
- control display

3. DEFINE TEMPORARY SPEND MODE TRANSFORMATIONS

For this prototype only, use the existing consumed value as the Actual baseline.

Then derive the other two modes from consumed using these exact temporary rules:

- Actual:
  consumedDisplay = consumed

- Commitment:
  consumedDisplay = consumed * 1.1

- Total Impact:
  consumedDisplay = consumed * 1.2

Apply the same mode-specific transformation to any dependent values as follows:

- Budget remains unchanged across all spend modes
- Consumed uses the transformed value above
- Remaining = budget - consumedDisplay
- Variance = budget - consumedDisplay
- Variance % = 0 if budget === 0, otherwise variance / budget
- Status continues using the existing temporary status rules based on the displayed row values

Do not explain this logic in the UI.

4. APPLY SPEND MODE TO ALL LEVELS

The selected spend mode must affect:
- LEVEL_0 dataset display
- LEVEL_1 dataset display
- LEVEL_2 dataset display
- LEVEL_3 dataset display
- KPI summaries for the active level

Do not change the underlying source datasets.
Apply the transformation only for display/rendering and summary purposes.

5. PRESERVE METRIC BEHAVIOR

Metric must continue to work exactly as it does now.

Order of transformation for the prototype must be:

- first apply Spend Mode to derive displayed consumed / remaining / variance
- then apply Metric transformation if metric === "ppd"

This order must apply consistently to:
- table values
- KPI values

Variance % remains relative and should not be altered by the metric transformation.

6. PRESERVE LABELS

Do not change any labels in this step except the displayed Spend Mode control value itself.

That means:
- metric-based PPD labels remain as implemented
- table column names stay the same
- KPI labels stay the same

7. EDITABILITY

Keep editability behavior unchanged in structure:

- Budget remains editable where currently editable
- Consumed remains editable where currently editable

For this prototype step:
- when Spend Mode is Actual, editable Consumed cells reflect the actual displayed value
- when Spend Mode is Commitment or Total Impact, continue rendering the displayed transformed value in the Consumed column, but inputs may remain visually editable if preserving current implementation requires it

Do not redesign edit behavior in this step.
Do not add warnings.
Do not add locking UI.

8. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill state
- dataset switching
- breadcrumb
- scope label
- Facility Scope control
- Timeframe control
- metric toggle behavior
- sorting/filtering behavior
- table structure
- view states
- layout
- styling beyond what is required for the control to display the active value

9. OUTPUT

After implementing, return:

1. SPEND MODE CONTROL ACTIVATED
2. SPEND MODE STATE ADDED
3. TABLE VALUE SWITCHING CONFIRMED
4. KPI VALUE SWITCHING CONFIRMED
5. METRIC + SPEND MODE ORDER CONFIRMED
6. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.