You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new functionality beyond what is explicitly described.
Do not change calculations, drill behavior, or existing control behavior.
Do not change layout or styling beyond what is required.

We are NOT adding a separate trust summary block.

OBJECTIVE

Consolidate report-level trust/context information into the existing Explainability Panel so there is one unified explainability surface instead of two separate areas.

CHANGES TO IMPLEMENT

1. DO NOT ADD A NEW TRUST SUMMARY BLOCK

Do not create any new block between the Report control bar and the KPI row.
Do not add any separate report summary area.

2. EXPAND THE EXISTING EXPLAINABILITY PANEL

Keep the Explainability Panel in its current location:
- below the breadcrumb
- above the table

Keep its existing row-level fields:
- Selected Row: [selectedRowName]
- Drill Level: [current drillState.level]
- Facility Scope: [level-aware value]
- Timeframe: [displayed Timeframe control value]
- Metric: [displayed Metric control value]
- Spend Mode: [displayed Spend Mode control value]

Add these new fields to the SAME panel:

- View Scope: [value]
- Timeframe Basis: [displayed Timeframe control value]
- Metric Basis: [displayed Metric control value]
- Spend Basis: [displayed Spend Mode control value]

3. DEFINE VIEW SCOPE VALUE

For the Explainability Panel:

- At LEVEL_0:
  - if Facility Scope control displays All Facilities, then:
    View Scope: All Facilities
  - otherwise:
    View Scope: [displayed Facility Scope control value]

- At LEVEL_1:
  - View Scope: Categories within [path[0]]

- At LEVEL_2:
  - View Scope: Vendors within [path[1]]

- At LEVEL_3:
  - View Scope: Transactions within [path[2]]

Use the current drill path values exactly as displayed elsewhere.

4. PANEL VISIBILITY RULE

Change the Explainability Panel visibility rule as follows:

The panel must be visible when either condition is true:
- selectedRowName is not null
- OR always-visible report-level context is being shown

For this step, make the panel always visible.

When no row is selected:
- render all report-level context fields
- render Selected Row as:
  - Selected Row: None

Keep Drill Level visible at all times.

5. PRESENTATION RULES

Keep the panel plain and minimal.

Requirements:
- no icons
- no badges
- no pills
- no accordion
- no tooltip
- no dismiss action

A simple bordered or lightly separated container is acceptable.

6. REMOVE DUPLICATION

Because the panel is now the single explainability surface:
- do not add any separate trust summary block anywhere else
- do not duplicate these values outside the panel

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- control behavior
- KPI calculations
- drill state
- dataset switching
- sorting/filtering
- density controls
- table columns
- table states
- breadcrumb
- scope label
- overall page order

8. OUTPUT

After implementing, return:

1. NO SEPARATE TRUST SUMMARY ADDED
2. EXPLAINABILITY PANEL EXPANDED
3. ALWAYS-VISIBLE PANEL CONFIRMED
4. VIEW SCOPE RULES APPLIED
5. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.