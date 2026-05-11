You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now aligning the temporary drill model to the intended multi-facility Budget vs Spend hierarchy.

OBJECTIVE

Define the meaning of the first two drill levels without adding deeper hierarchy yet.

After this step:
- LEVEL_0 must represent Facilities
- LEVEL_1 must represent Categories within the selected Facility

Do not implement LEVEL_2 or beyond.

CHANGES TO IMPLEMENT

1. DEFINE LEVEL_0 AS FACILITIES

Keep the existing LEVEL_0 dataset values for now, but treat them as facility names.

This means the current LEVEL_0 rows:
- Engineering
- Marketing
- Operations
- Sales
- HR

must now be understood and displayed as Facilities.

Do not rename these row values yet.
Do not change the dataset itself.

2. DEFINE LEVEL_1 AS CATEGORIES WITHIN FACILITY

Replace the temporary LEVEL_1 row names:

- Child A
- Child B
- Child C

with these exact values:

- Food
- Supplies
- Services

Keep the existing numeric values exactly as they are:

[
  { name: "Food", budget: 12000, actual: 10000, variance: 2000 },
  { name: "Supplies", budget: 8000, actual: 9500, variance: -1500 },
  { name: "Services", budget: 4000, actual: 3000, variance: 1000 }
]

3. UPDATE THE BREADCRUMB LABELING

At LEVEL_0:
- breadcrumb remains: All Facilities

At LEVEL_1:
- breadcrumb must render: All Facilities > [Selected Facility]

Use path[0] as the selected facility name.

4. ADD A SCOPE LABEL ABOVE THE TABLE

Replace the temporary "Current Level: LEVEL_X" text with a more meaningful plain text scope label.

Render exactly:

At LEVEL_0:
- Scope: Facilities

At LEVEL_1:
- Scope: Categories within [Selected Facility]

Examples:
- Scope: Facilities
- Scope: Categories within Engineering

This must remain plain text only.
Do not style it as a badge, pill, or heading treatment beyond normal text.

5. KEEP THE TABLE COLUMN LABEL AS "Name"

Do not rename "Name" yet.
At LEVEL_0 it will represent Facility name.
At LEVEL_1 it will represent Category name.

6. KEEP DRILL BEHAVIOR AS-IS

Do not change behavior:
- LEVEL_0 rows drill to LEVEL_1
- LEVEL_1 rows do nothing

Do not add deeper levels.
Do not add LEVEL_2 state.
Do not change dataset switching rules beyond the LEVEL_1 row names.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- sorting
- filtering
- density controls
- layout
- styling
- breadcrumb interaction
- audit event structure

8. OUTPUT

After implementing, return:

1. LEVEL MEANING ALIGNED
2. LEVEL_1 DATA RENAMED
3. SCOPE LABEL UPDATED
4. BREADCRUMB CONFIRMED
5. CONFIRMATION THAT DRILL DEPTH DID NOT CHANGE

Do not propose next steps.
Stop after reporting changes.