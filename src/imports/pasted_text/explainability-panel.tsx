You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change existing controls, drill behavior, layout, or styling unless instructed.

You are now adding a minimal explainability layer to the Budget vs Spend prototype.

OBJECTIVE

Add a simple row-level explainability panel so a user can inspect the context behind the currently selected row without changing drill behavior.

This panel is for trust and context only.
It must NOT perform calculations.
It must NOT alter drill state.
It must NOT replace the existing drill interaction.

CHANGES TO IMPLEMENT

1. ADD ROW SELECTION STATE

Add a new local state:

selectedRowName: string | null

Default:
- null

This state must track the most recently clicked row name at the currently displayed level.

2. PRESERVE DRILL BEHAVIOR

Existing row click behavior must remain exactly as it is:
- LEVEL_0 rows still drill to LEVEL_1
- LEVEL_1 rows still drill to LEVEL_2
- LEVEL_2 rows still drill to LEVEL_3
- LEVEL_3 rows do nothing

In addition:
- whenever a row is clicked at any level, update selectedRowName to row.original.name

Important:
- do not block drill
- do not replace drill
- do not require a second click

3. ADD EXPLAINABILITY PANEL

Add a simple panel below the breadcrumb and above the table.

Render this panel only when:
- selectedRowName is not null

The panel must contain these exact label/value pairs, each on its own line or in a simple stacked layout:

- Selected Row: [selectedRowName]
- Drill Level: [current drillState.level]
- Facility Scope: [displayed Facility Scope control value]
- Timeframe: [displayed Timeframe control value]
- Metric: [displayed Metric control value]
- Spend Mode: [displayed Spend Mode control value]

4. LEVEL-AWARE FACILITY VALUE

For the Explainability Panel only:
- at LEVEL_0, Facility Scope should reflect the active Facility Scope control value
- at LEVEL_1, LEVEL_2, LEVEL_3, Facility Scope should reflect path[0]

5. PANEL PRESENTATION RULES

Keep the panel plain and minimal.

Requirements:
- no icons
- no badges
- no pills
- no accordions
- no tooltips
- no dismiss button
- no background illustrations

Simple bordered or lightly separated container is acceptable.
Do not restyle the page beyond what is minimally necessary to place the panel cleanly.

6. RESET BEHAVIOR

When clicking breadcrumb segments:
- keep all existing breadcrumb reset behavior exactly as-is

Additionally:
- when breadcrumb navigation changes level, clear selectedRowName back to null

When clicking "All Facilities":
- selectedRowName becomes null

When clicking the Facility segment at LEVEL_2 or LEVEL_3:
- selectedRowName becomes null

When clicking the Category segment at LEVEL_3:
- selectedRowName becomes null

7. VIEW STATE BEHAVIOR

The Explainability Panel must remain visible in:
- default
- loading
- empty
- error

as long as selectedRowName is not null.

Do not hide it just because the table body is showing a non-default view state.

8. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill state shape
- dataset switching by level
- KPI calculations
- transformations
- control behavior
- sorting/filtering
- density controls
- table columns
- table states
- overall layout beyond placing the panel

9. OUTPUT

After implementing, return:

1. ROW SELECTION STATE ADDED
2. EXPLAINABILITY PANEL ADDED
3. ROW CLICK + DRILL BEHAVIOR PRESERVED
4. BREADCRUMB RESET BEHAVIOR CONFIRMED
5. VIEW STATE VISIBILITY CONFIRMED
6. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.