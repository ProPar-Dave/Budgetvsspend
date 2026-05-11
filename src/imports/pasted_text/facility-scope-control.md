You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not modify any controls other than what is explicitly described.
Do not change layout, styling, or behavior beyond what is required.

You are now activating the Facility Scope control.

OBJECTIVE

Make the Facility Scope control functional in a tightly constrained way that supports the portfolio view without conflicting with drill behavior.

This change must affect:
- LEVEL_0 table rows
- LEVEL_0 KPI values
- displayed control value

It must NOT affect:
- drill structure
- breadcrumb behavior
- scope label logic
- LEVEL_1, LEVEL_2, or LEVEL_3 datasets

CHANGES TO IMPLEMENT

1. ACTIVATE FACILITY SCOPE CONTROL

Convert the Facility Scope control from display-only into a simple toggle cycling through these exact values in this exact order:

- All Facilities
- North Ridge
- Pine Grove
- Cedar Falls
- Willow Creek
- Maple Terrace

Default:
- All Facilities

Requirements:
- clicking advances to the next value
- after Maple Terrace, cycle back to All Facilities
- no dropdown
- no additional options

2. ADD FACILITY SCOPE STATE

Add a new state:

facilityScope: "all" | "North Ridge" | "Pine Grove" | "Cedar Falls" | "Willow Creek" | "Maple Terrace"

Default:
- "all"

This state must be accessible to:
- LEVEL_0 table rendering
- LEVEL_0 KPI calculations
- control display

3. DEFINE FACILITY SCOPE BEHAVIOR AT LEVEL_0

At LEVEL_0 only:

- when facilityScope === "all"
  - render the full Facilities dataset
  - KPI row summarizes the full Facilities dataset

- when facilityScope is a specific facility name
  - render only the matching facility row at LEVEL_0
  - KPI row summarizes only that single displayed facility row

Do not change the underlying source dataset.
Apply filtering only for display/rendering and summary purposes at LEVEL_0.

4. DEFINE FACILITY SCOPE BEHAVIOR BELOW LEVEL_0

At LEVEL_1, LEVEL_2, and LEVEL_3:

- do NOT use facilityScope to filter the currently displayed child dataset
- keep current drill-driven dataset behavior exactly as it is

Display rule:
- when drillState.level !== "LEVEL_0", the Facility Scope control must display the selected drilled facility from path[0]
- clicking the Facility Scope control while drillState.level !== "LEVEL_0" must do nothing

Examples:
- at LEVEL_1 inside North Ridge, control displays: North Ridge
- at LEVEL_2 inside North Ridge > Food, control displays: North Ridge
- at LEVEL_3 inside North Ridge > Food > Sysco, control displays: North Ridge

5. PRESERVE DRILL BEHAVIOR

Do not change drill behavior.

This means:
- clicking a LEVEL_0 row still drills to LEVEL_1
- the selected facility in the drill path continues to come from the clicked row
- facilityScope does not replace drill selection logic

Important:
- if facilityScope is set to a specific facility at LEVEL_0, and the user clicks that row, drill continues exactly as before

6. PRESERVE TRANSFORMATION ORDER

Keep the existing transformation order exactly as it is:

1. start from source dataset
2. apply Spend Mode transformation
3. apply Timeframe multiplier
4. apply Metric transformation if metric === "ppd"

Facility Scope filtering at LEVEL_0 should apply to the row set being displayed and summarized.
Do not change transformation logic within each row.

7. PRESERVE LABELS

Do not change any labels in this step except the displayed Facility Scope control value itself.

8. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill state
- dataset switching by level
- breadcrumb
- scope label
- Timeframe behavior
- Metric behavior
- Spend Mode behavior
- sorting/filtering behavior
- table structure
- view states
- layout
- styling beyond what is required for the control to display the active value

9. OUTPUT

After implementing, return:

1. FACILITY SCOPE CONTROL ACTIVATED
2. FACILITY SCOPE STATE ADDED
3. LEVEL_0 FILTERING CONFIRMED
4. BELOW-LEVEL_0 DISPLAY RULE CONFIRMED
5. DRILL BEHAVIOR PRESERVED
6. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.