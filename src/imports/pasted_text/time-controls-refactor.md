You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not redesign the page.
Do not change layout, spacing, styling, hierarchy, or visual language except where explicitly required below.
Do not change KPI layout, table layout, drill behavior, calculations, or data model.
Do not add new panels, helper sections, charts, or explanatory copy.
Do not remove existing controls unless explicitly instructed below.

OBJECTIVE

Refactor the current timeframe control model so the report supports:

1. selecting a reporting span
2. selecting how that span is divided for viewing

The UI must separate these two concepts clearly.

Use:
- Timeframe = selected reporting span
- View By = how the selected span is partitioned

This is a control and behavior refinement pass only.

CHANGES TO IMPLEMENT

1. REPLACE THE CURRENT OVERLOADED TIMEFRAME MODEL WITH TWO COORDINATED CONTROLS

The report must use two separate controls:

- Timeframe
- View By

Timeframe selects the reporting span.
View By selects how that span is divided.

Do not combine span and division into one control.

2. KEEP THE EXISTING CONTROL ROW STYLE

Use the same visual language already established in the top control row.

The new View By control must feel like a natural part of the existing control system.

Do not redesign the row.
Do not introduce a different control style.

3. PLACE VIEW BY ADJACENT TO TIMEFRAME

Add the new View By control next to Timeframe so the relationship is visually clear.

Preserve the rest of the control row as much as possible.

Do not reshuffle the full page hierarchy.
Do not create a new sub-row.

4. DEFINE TIMEFRAME OPTIONS

Set the Timeframe control options to:

- Last 7 Days
- Last 30 Days
- Month to Date
- Last Month
- Quarter to Date
- Last Quarter
- Year to Date
- Last 12 Months
- Custom Range

Use these labels exactly.

5. DEFINE VIEW BY OPTIONS

Set the View By control options to:

- Daily
- Weekly
- Monthly
- Quarterly

Use these labels exactly.

6. ENFORCE VALID VIEW BY OPTIONS FOR EACH TIMEFRAME

The View By control must allow only valid options for the selected Timeframe.

Use this matrix:

Last 7 Days
- Daily only

Last 30 Days
- Daily
- Weekly

Month to Date
- Daily
- Weekly

Last Month
- Daily
- Weekly

Quarter to Date
- Weekly
- Monthly

Last Quarter
- Weekly
- Monthly

Year to Date
- Monthly
- Quarterly

Last 12 Months
- Monthly
- Quarterly

Custom Range
- 1 to 14 days:
  - Daily
- 15 to 60 days:
  - Daily
  - Weekly
- 61 to 180 days:
  - Weekly
  - Monthly
- 181 to 730 days:
  - Monthly
  - Quarterly

7. PRESERVE VIEW BY WHEN STILL VALID

When the user changes Timeframe:
- preserve the currently selected View By if it remains valid for the new Timeframe

If it is no longer valid:
- automatically switch View By to the nearest sensible valid option

Use these defaults when automatic selection is required:
- for 7 to 60 day spans: Weekly if Daily is not already selected and valid
- for quarter spans: Monthly
- for year-level spans: Monthly
- for very short spans where only one option is valid: select that option automatically

8. KEEP VIEW BY VISIBLE EVEN WHEN OPTIONS ARE LIMITED

Do not hide the View By control when only one option is valid.

Keep the control visible for consistency.

If only one option is valid:
- show that selected option
- disable or prevent invalid options appropriately

9. SET DEFAULT STATE

Set the default report state to:

- Timeframe = Month to Date
- View By = Weekly

Do not change the current defaults for Metric, Spend Mode, Pivot By, or Table Size unless required by existing prototype behavior.

10. DO NOT CHANGE REPORT MEANING

This change must affect only time selection and partition behavior.

Do not change:
- KPI meaning
- table meaning
- drill structure
- spend logic
- metric logic
- excluded logic

The report must still feel like the same governed analytical surface.

11. PRESERVE ALL OTHER EXISTING UI AND BEHAVIOR

Do not change:
- Pivot By control
- Metric control
- Spend Mode control
- Table Size control
- breadcrumb
- scope line
- KPI styling
- table styling
- number formatting
- sorting
- filtering
- row interaction
- status styling

OUTPUT

After implementing, return exactly:

1. TIMEFRAME AND VIEW BY ARE NOW SEPARATE CONTROLS
2. VIEW BY ADDED NEXT TO TIMEFRAME USING EXISTING CONTROL ROW STYLE
3. TIMEFRAME OPTIONS UPDATED TO THE REQUIRED SET
4. VIEW BY OPTIONS UPDATED TO DAILY / WEEKLY / MONTHLY / QUARTERLY
5. VALID TIMEFRAME-TO-VIEW-BY RULES APPLIED
6. INVALID VIEW BY OPTIONS NOW RESTRICTED BASED ON TIMEFRAME
7. DEFAULT STATE SET TO MONTH TO DATE / WEEKLY
8. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.