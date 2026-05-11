You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now adding the foundational summary KPI row to the Budget vs Spend prototype.

OBJECTIVE

Add a simple summary KPI row above the table that reflects the currently rendered dataset for the active drill level.

After this step, the prototype must display these KPI cards:

- Total Budget
- Total Consumed
- Total Remaining
- Total Variance
- Variance %

Do not add any other KPI cards yet.
Do not add charts.
Do not add status counts yet.

CHANGES TO IMPLEMENT

1. ADD KPI ROW ABOVE THE TABLE

Place a simple KPI row above:
- scope label
- breadcrumb
- table

It should sit below the existing controls area.

Render exactly five KPI cards, in this order:

- Total Budget
- Total Consumed
- Total Remaining
- Total Variance
- Variance %

Keep the presentation simple and consistent.
Do not add icons.
Do not add sparklines.
Do not add badges.

2. KPI VALUES MUST REFLECT THE CURRENTLY RENDERED DATASET

The KPI values must summarize whichever dataset is currently active based on drill level:

- LEVEL_0 → Facilities dataset
- LEVEL_1 → Categories dataset
- LEVEL_2 → Vendors dataset
- LEVEL_3 → Transactions dataset

Do not summarize hidden levels.
Do not summarize all levels at once.
Use only the currently displayed row set.

3. KPI VALUE DEFINITIONS

For this step, compute KPI values from the active dataset as follows:

- Total Budget = sum of budget
- Total Consumed = sum of consumed
- Total Remaining = sum of remaining
- Total Variance = sum of variance
- Variance %:
  - 0 if Total Budget === 0
  - otherwise Total Variance / Total Budget

These calculations are temporary prototype scaffolding for the summary row only.

4. FORMATTING

Use simple display formatting:

- Total Budget, Total Consumed, Total Remaining, Total Variance:
  - currency-style whole numbers
  - no decimals required

- Variance %:
  - whole percent
  - examples: 4%, -15%, 0%

Do not add explanatory text.
Do not add tooltips.

5. PRESERVE TABLE STATES

When viewState is:
- "loading"
- "empty"
- "error"

the KPI row should still remain visible and continue reflecting the active dataset for the current drill level.

Do not hide the KPI row in those states.

6. PRESERVE ALL OTHER BEHAVIOR

Do NOT change:
- table columns
- drill state shape
- drill depth
- dataset switching by level
- breadcrumb behavior
- row click behavior
- sorting
- filtering
- density controls
- overall layout beyond adding the KPI row
- existing state presentations

7. OUTPUT

After implementing, return:

1. KPI ROW ADDED
2. KPI DEFINITIONS APPLIED
3. KPI DATASET SCOPING CONFIRMED
4. KPI VISIBILITY ACROSS VIEW STATES CONFIRMED
5. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.