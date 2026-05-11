You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change existing controls, layout, or styling unless instructed.

You are now adding the foundational Budget vs Spend report control bar in display-only form.

OBJECTIVE

Add the core report controls this surface will require, but do NOT make them functional yet.

After this step, the prototype must display these controls above the KPI row:

- Facility Scope
- Timeframe
- Metric
- Spend Mode

These controls are display-only scaffolding for now.
Do not connect them to data.
Do not change the table.
Do not add filtering behavior beyond what already exists in the table headers.

CHANGES TO IMPLEMENT

1. ADD A REPORT CONTROL BAR

Place a simple horizontal control bar above the KPI row.

It should sit below the existing density controls area.

Render exactly four controls in this order:

- Facility Scope
- Timeframe
- Metric
- Spend Mode

Keep the presentation simple and aligned with the existing prototype style.

2. CONTROL VALUES TO DISPLAY

Render the following exact labels and values:

- Facility Scope: All Facilities
- Timeframe: Month to Date
- Metric: Dollars
- Spend Mode: Actual

3. CONTROL PRESENTATION RULES

These controls must appear as simple display-only selectors.

Acceptable presentation:
- button-like fields
- simple segmented fields
- select-style boxes

But for this step they must be NON-FUNCTIONAL.

Requirements:
- no dropdown menus
- no expanded menus
- no click behavior
- no hover behavior implying interaction beyond normal visual affordance
- no state changes
- no icons required

4. DO NOT CONNECT CONTROLS TO DATA

The values shown in the control bar must NOT:
- change the dataset
- change the KPIs
- change drill behavior
- change table values
- change columns
- change sorting or filtering

They are visual scaffolding only in this step.

5. PRESERVE EXISTING UI

Keep all existing pieces exactly as they are:
- density controls
- KPI row
- scope label
- breadcrumb
- table
- view states
- drill hierarchy

Do not remove or restyle them beyond what is minimally necessary to place the new control bar cleanly.

6. OUTPUT

After implementing, return:

1. CONTROL BAR ADDED
2. DISPLAY VALUES CONFIRMED
3. NON-FUNCTIONAL BEHAVIOR CONFIRMED
4. CONFIRMATION THAT DATA AND TABLE BEHAVIOR DID NOT CHANGE

Do not propose next steps.
Stop after reporting changes.