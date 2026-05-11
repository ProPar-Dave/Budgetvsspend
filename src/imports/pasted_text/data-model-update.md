You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are only aligning the current temporary drill structure to a clearer naming model.

OBJECTIVE

Replace the temporary "category" framing with a neutral row label model that can support the eventual hierarchy, without yet assuming final business labels beyond what is explicitly defined here.

CHANGES TO IMPLEMENT

1. REPLACE THE PRIMARY ROW KEY

The table currently uses:
- category

Replace this with:
- name

Apply this consistently to:
- LEVEL_0 dataset
- LEVEL_1 dataset
- column accessor / field usage
- row click target
- breadcrumb path values
- any cell renderers or references

2. KEEP THE CURRENT COLUMN LABEL TEMPORARILY

Rename the first column header label from:
- Category

to:
- Name

Do not rename any other columns.

The columns after this step must be exactly:
- Name
- Budget
- Actual
- Variance

3. UPDATE DATASETS

LEVEL_0 data should keep the same row values, but use `name` instead of `category`.

Example:
{ name: "Engineering", budget: ..., actual: ..., variance: ... }

LEVEL_1 temporary data should also use `name` instead of `category`.

Example:
{ name: "Child A", budget: 12000, actual: 10000, variance: 2000 }

4. UPDATE DRILL EVENT PAYLOAD

At LEVEL_0 row click, continue emitting DRILL_DOWN.

Update payload to use:
{
  type: "DRILL_DOWN",
  level: "LEVEL_0",
  target: row.original.name
}

Do not change anything else about the event.

5. UPDATE BREADCRUMB BINDING

At LEVEL_1, breadcrumb should still render:
- All Facilities > X

But X must now come from:
- path[0] derived from row.original.name

6. DO NOT CHANGE DRILL DEPTH

Keep current drill behavior exactly as-is:
- LEVEL_0 rows drill to LEVEL_1
- LEVEL_1 rows do nothing

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- sorting
- filtering
- density controls
- dataset switching logic
- current level label
- breadcrumb layout
- styling except the first column label text

8. OUTPUT

After implementing, return:

1. COLUMN LABEL UPDATED
2. DATA MODEL UPDATED
3. DRILL EVENT UPDATED
4. BREADCRUMB BINDING UPDATED
5. CONFIRMATION THAT BEHAVIOR DID NOT OTHERWISE CHANGE

Do not propose next steps.
Stop after reporting changes.