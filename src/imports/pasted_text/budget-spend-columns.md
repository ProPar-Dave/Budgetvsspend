You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now aligning the table columns to the foundational Budget vs Spend structure.

OBJECTIVE

Replace the current temporary financial column model with the foundational report column model.

After this step, the table columns must be exactly:

- Name
- Budget
- Consumed
- Remaining
- Variance

Do not add Variance % yet.
Do not add Status yet.

CHANGES TO IMPLEMENT

1. RENAME "Actual" TO "Consumed"

Replace the current column label:
- Actual

with:
- Consumed

Update the underlying accessor/key usage as needed so the dataset and table are consistent.

2. ADD "Remaining" COLUMN

Add a new column:
- Remaining

Place it between:
- Consumed
and
- Variance

After this step, the column order must be exactly:
- Name
- Budget
- Consumed
- Remaining
- Variance

3. UPDATE DATA MODEL

Replace the current row field:
- actual

with:
- consumed

Apply this consistently to:
- LEVEL_0 dataset
- LEVEL_1 dataset
- column accessors
- any editable cell logic
- any references in rendering or events

4. DEFINE "Remaining" TEMPORARILY

For this step only, Remaining may be computed from the current row values as:

remaining = budget - consumed

This is temporary UI scaffolding only so the table can display the intended shape.
Do not add explanatory text about this.
Do not change any other business logic.

5. KEEP "Variance" AS-IS FOR NOW

Do not rename Variance.
Do not change its placement other than moving it after Remaining.
Do not add percentage logic.
Do not change its existing visual treatment.

6. EDITABILITY

Preserve current edit behavior as closely as possible:

- Budget remains editable where it is currently editable
- Consumed remains editable wherever Actual was previously editable
- Remaining is read-only
- Variance remains read-only

Do not expand editability beyond current behavior.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill behavior
- breadcrumb
- scope label
- sorting behavior
- filtering behavior
- density controls
- layout
- styling except what is required for the new column

8. OUTPUT

After implementing, return:

1. COLUMN SET UPDATED
2. DATA MODEL UPDATED
3. REMAINING COLUMN ADDED
4. EDITABILITY CONFIRMED
5. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.