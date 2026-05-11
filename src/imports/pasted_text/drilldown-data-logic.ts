You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, styling, or layout unless instructed.

You are now implementing the first real dataset transition for drilldown.

OBJECTIVE

When the user drills from LEVEL_0 to LEVEL_1, the table must render a different row set.
This is a temporary proof of drill behavior only.
Do not attempt to model the final business hierarchy beyond what is explicitly defined here.

CHANGES TO IMPLEMENT

1. KEEP LEVEL_0 DATA AS-IS

At LEVEL_0:
- keep the current existing dataset exactly as it is
- keep current columns exactly as they are
- keep sorting/filtering behavior exactly as it is

2. ADD A TEMPORARY LEVEL_1 DATASET

When drillState.level === "LEVEL_1", replace the table rows with a temporary hardcoded child dataset.

Use this exact LEVEL_1 dataset shape and values:

[
  { category: "Child A", budget: 12000, actual: 10000, variance: 2000 },
  { category: "Child B", budget: 8000, actual: 9500, variance: -1500 },
  { category: "Child C", budget: 4000, actual: 3000, variance: 1000 }
]

Important:
- keep using the existing current column keys and labels
- do not rename columns yet
- do not add new columns yet
- do not derive values from the parent row
- always use this exact hardcoded LEVEL_1 dataset for now

3. DATASET SWITCHING RULE

Render dataset based only on drill state:

- if drillState.level === "LEVEL_0" → render current existing dataset
- if drillState.level === "LEVEL_1" → render the hardcoded LEVEL_1 dataset above

Do not add LEVEL_2 or beyond.
Do not simulate deeper hierarchy yet.

4. BREADCRUMB BEHAVIOR

Keep current breadcrumb behavior.

At LEVEL_1:
- breadcrumb must still render: All Facilities > X
- X is the selected row target stored in path[0]

Clicking "All Facilities" must:
- reset drillState to LEVEL_0
- restore the original LEVEL_0 dataset view

5. CURRENT LEVEL LABEL

Keep the existing plain text label:
- Current Level: LEVEL_0
- Current Level: LEVEL_1

6. CLICK BEHAVIOR AT LEVEL_1

For now:
- rows at LEVEL_1 should NOT drill further
- clicking LEVEL_1 rows should do nothing
- do not emit a deeper drill event
- do not advance state beyond LEVEL_1

This is intentional for this step.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- columns
- filters
- sort behavior
- density controls
- layout
- styling except what is minimally necessary for the dataset switch

8. OUTPUT

After implementing, return:

1. LEVEL_0 DATA CONFIRMED
2. LEVEL_1 DATA ADDED
3. DATASET SWITCHING CONFIRMED
4. RESET TO LEVEL_0 CONFIRMED
5. CONFIRMATION THAT LEVEL_1 DOES NOT DRILL FURTHER

Do not propose next steps.
Stop after reporting changes.