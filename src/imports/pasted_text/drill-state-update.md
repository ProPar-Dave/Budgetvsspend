You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change columns, controls, data, or styling unless instructed.

You are only adding drill state and breadcrumb state.

OBJECTIVE

Introduce a minimal drill state model so the table can track where the user is in the hierarchy, without yet changing the dataset or rendering a new level.

CHANGES TO IMPLEMENT

1. ADD DRILL STATE

Add a drill state object to lifted grid/app state.

Use this exact shape:

{
  level: "LEVEL_0",
  path: []
}

Definitions:
- level is the current hierarchy level
- path is an ordered array of selected drill targets

For now, LEVEL_0 means the top table state.

2. UPDATE ROW CLICK BEHAVIOR

Keep rows clickable.

When a row is clicked:
- update drill state to:
  - level: "LEVEL_1"
  - path: [row.original.category]

Also continue emitting the existing audit/log event:
{
  type: "DRILL_DOWN",
  level: "LEVEL_0",
  target: row.original.category
}

Do NOT change the table data yet.
Do NOT load a new dataset yet.
Do NOT simulate level-specific rows yet.

3. ADD BREADCRUMB UI

Add a simple breadcrumb above the table.

Render exactly:
- All Facilities

When drill state is LEVEL_1 with path [X], render:
- All Facilities > X

Requirements:
- breadcrumb must be visible above the table body
- breadcrumb must be plain and minimal
- use text buttons or simple clickable text
- no icons required
- no dropdown behavior
- no chips or pills

4. ADD BREADCRUMB INTERACTION

Make breadcrumb segments clickable.

Behavior:
- clicking "All Facilities" resets drill state to:
  {
    level: "LEVEL_0",
    path: []
  }

Do NOT change dataset on reset.
Do NOT change sorting, filters, or controls.

If path contains X, clicking X does nothing for now.
Only "All Facilities" needs behavior in this step.

5. CONTEXT LABEL

Above or near the breadcrumb, add a minimal text label showing current level.

Use exactly:
- "Current Level: LEVEL_0"
- "Current Level: LEVEL_1"

This is temporary debugging UI and should be plain text only.

6. PRESERVE EVERYTHING ELSE

Do NOT change:
- columns
- sorting
- filtering
- density controls
- dataset
- metric logic
- styling except what is required to place breadcrumb/context text

7. OUTPUT

After implementing, return:

1. DRILL STATE ADDED
2. BREADCRUMB ADDED
3. CLICK BEHAVIOR CONFIRMED
4. RESET BEHAVIOR CONFIRMED
5. CONFIRMATION THAT DATASET STILL DOES NOT CHANGE

Do not propose next steps.
Stop after reporting changes.