You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now extending the drill model by one level.

OBJECTIVE

Add LEVEL_2 to the existing drill hierarchy.

After this step:
- LEVEL_0 represents Facilities
- LEVEL_1 represents Categories within the selected Facility
- LEVEL_2 represents Vendors within the selected Category

Do not implement any level deeper than LEVEL_2.

CHANGES TO IMPLEMENT

1. ADD LEVEL_2 DRILL STATE SUPPORT

Extend the existing drill state model to support:
- LEVEL_2
- path with two values

Expected path behavior:
- At LEVEL_1: path = [Selected Facility]
- At LEVEL_2: path = [Selected Facility, Selected Category]

Do not change the basic drillState shape.
Keep:
{
  level: string,
  path: string[]
}

2. ADD TEMPORARY LEVEL_2 DATASET

Add a temporary hardcoded LEVEL_2 dataset with these exact values:

[
  { name: "Sysco", budget: 7000, consumed: 6200, variance: 800 },
  { name: "US Foods", budget: 5000, consumed: 6100, variance: -1100 },
  { name: "Local Dairy Co", budget: 2000, consumed: 1700, variance: 300 }
]

For this step:
- keep using the same existing columns
- Remaining may continue using the current temporary computation
- Variance % may continue using the current temporary computation
- Status may continue using the current temporary rules

3. DATASET SWITCHING RULES

Render dataset based on drill level only:

- LEVEL_0 → existing Facilities dataset
- LEVEL_1 → existing Categories dataset
- LEVEL_2 → new Vendors dataset

Do not derive child datasets from selected row values.
Do not add dynamic data loading.
Use the exact hardcoded LEVEL_2 dataset whenever drillState.level === "LEVEL_2".

4. ENABLE DRILL FROM LEVEL_1 TO LEVEL_2

At LEVEL_1 only:
- rows become clickable
- clicking a row drills to LEVEL_2

When a LEVEL_1 row is clicked:
- update drillState to:
  {
    level: "LEVEL_2",
    path: [current selected facility, clicked category]
  }

Also emit an audit/log event:

{
  type: "DRILL_DOWN",
  level: "LEVEL_1",
  target: row.original.name
}

At LEVEL_2:
- rows should do nothing
- no deeper drill
- no additional drill event

5. UPDATE BREADCRUMB

Render breadcrumb as follows:

At LEVEL_0:
- All Facilities

At LEVEL_1:
- All Facilities > [Selected Facility]

At LEVEL_2:
- All Facilities > [Selected Facility] > [Selected Category]

Requirements:
- every breadcrumb segment must render as text
- "All Facilities" must remain clickable and reset to LEVEL_0
- at LEVEL_2, clicking the selected Facility segment must reset to:
  {
    level: "LEVEL_1",
    path: [Selected Facility]
  }

The selected Category segment at LEVEL_2 does nothing for now.

6. UPDATE SCOPE LABEL

Replace the scope label text as follows:

At LEVEL_0:
- Scope: Facilities

At LEVEL_1:
- Scope: Categories within [Selected Facility]

At LEVEL_2:
- Scope: Vendors within [Selected Category]

Examples:
- Scope: Facilities
- Scope: Categories within Engineering
- Scope: Vendors within Food

Keep this as plain text only.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- columns
- column labels
- sorting behavior
- filtering behavior
- density controls
- overall layout
- styling except row click affordance where needed for LEVEL_1 rows

8. OUTPUT

After implementing, return:

1. LEVEL_2 ADDED
2. LEVEL_2 DATASET ADDED
3. LEVEL_1 TO LEVEL_2 DRILL CONFIRMED
4. BREADCRUMB UPDATED
5. SCOPE LABEL UPDATED
6. CONFIRMATION THAT LEVEL_2 DOES NOT DRILL FURTHER

Do not propose next steps.
Stop after reporting changes.