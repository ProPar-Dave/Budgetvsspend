You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now extending the drill model to the final evidence level.

OBJECTIVE

Add LEVEL_3 to the existing drill hierarchy.

After this step:
- LEVEL_0 represents Facilities
- LEVEL_1 represents Categories within the selected Facility
- LEVEL_2 represents Vendors within the selected Category
- LEVEL_3 represents Transactions within the selected Vendor

Do not implement any level deeper than LEVEL_3.

CHANGES TO IMPLEMENT

1. ADD LEVEL_3 DRILL STATE SUPPORT

Extend the existing drill state model to support:
- LEVEL_3
- path with three values

Expected path behavior:
- At LEVEL_1: path = [Selected Facility]
- At LEVEL_2: path = [Selected Facility, Selected Category]
- At LEVEL_3: path = [Selected Facility, Selected Category, Selected Vendor]

Do not change the basic drillState shape.
Keep:
{
  level: string,
  path: string[]
}

2. ADD TEMPORARY LEVEL_3 DATASET

Add a temporary hardcoded LEVEL_3 dataset with these exact values:

[
  { name: "INV-1001", budget: 3000, consumed: 2800, variance: 200 },
  { name: "INV-1002", budget: 2500, consumed: 3100, variance: -600 },
  { name: "INV-1003", budget: 1500, consumed: 1200, variance: 300 }
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
- LEVEL_2 → existing Vendors dataset
- LEVEL_3 → new Transactions dataset

Do not derive child datasets from selected row values.
Do not add dynamic data loading.
Use the exact hardcoded LEVEL_3 dataset whenever drillState.level === "LEVEL_3".

4. ENABLE DRILL FROM LEVEL_2 TO LEVEL_3

At LEVEL_2 only:
- rows become clickable
- clicking a row drills to LEVEL_3

When a LEVEL_2 row is clicked:
- update drillState to:
  {
    level: "LEVEL_3",
    path: [current selected facility, current selected category, clicked vendor]
  }

Also emit an audit/log event:

{
  type: "DRILL_DOWN",
  level: "LEVEL_2",
  target: row.original.name
}

At LEVEL_3:
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

At LEVEL_3:
- All Facilities > [Selected Facility] > [Selected Category] > [Selected Vendor]

Requirements:
- every breadcrumb segment must render as text
- "All Facilities" must remain clickable and reset to LEVEL_0
- at LEVEL_2 and LEVEL_3, clicking the selected Facility segment must reset to:
  {
    level: "LEVEL_1",
    path: [Selected Facility]
  }
- at LEVEL_3, clicking the selected Category segment must reset to:
  {
    level: "LEVEL_2",
    path: [Selected Facility, Selected Category]
  }

The selected Vendor segment at LEVEL_3 does nothing for now.

6. UPDATE SCOPE LABEL

Render scope label as follows:

At LEVEL_0:
- Scope: Facilities

At LEVEL_1:
- Scope: Categories within [Selected Facility]

At LEVEL_2:
- Scope: Vendors within [Selected Category]

At LEVEL_3:
- Scope: Transactions within [Selected Vendor]

Examples:
- Scope: Facilities
- Scope: Categories within Engineering
- Scope: Vendors within Food
- Scope: Transactions within Sysco

Keep this as plain text only.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- columns
- column labels
- sorting behavior
- filtering behavior
- density controls
- overall layout
- styling except row click affordance where needed for LEVEL_2 rows

8. OUTPUT

After implementing, return:

1. LEVEL_3 ADDED
2. LEVEL_3 DATASET ADDED
3. LEVEL_2 TO LEVEL_3 DRILL CONFIRMED
4. BREADCRUMB UPDATED
5. SCOPE LABEL UPDATED
6. CONFIRMATION THAT LEVEL_3 DOES NOT DRILL FURTHER

Do not propose next steps.
Stop after reporting changes.