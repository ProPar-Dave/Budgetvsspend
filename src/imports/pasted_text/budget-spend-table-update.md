You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now extending the table from the foundational financial shape to the foundational analytical shape.

OBJECTIVE

Add the final two foundational columns needed for the first robust Budget vs Spend table:

- Variance %
- Status

After this step, the table columns must be exactly:

- Name
- Budget
- Consumed
- Remaining
- Variance
- Variance %
- Status

Do not add any other columns.
Do not change drill depth.
Do not add new controls.

CHANGES TO IMPLEMENT

1. ADD "VARIANCE %" COLUMN

Add a new read-only column:
- Variance %

Place it between:
- Variance
and
- Status

For this step only, Variance % may be computed as:

variancePercent = 
- 0 if budget === 0
- otherwise variance / budget

Display formatting:
- show as a percentage
- round to whole percent
- examples: 20%, -19%, 0%

Do not add explanatory text.
Do not add tooltips.

2. ADD "STATUS" COLUMN

Add a new read-only column:
- Status

Place it after:
- Variance %

The Status value must be derived from the row values using these exact temporary rules:

- "Over Budget" when variance < 0
- "Healthy" when variance >= 0 and remaining > 0
- "No Budget" when budget === 0

Apply these rules exactly.
Do not add any other statuses yet.
Do not reinterpret the logic.

3. STATUS VISUAL TREATMENT

Keep it simple.

Apply a minimal text treatment only:
- Over Budget: red text
- Healthy: green text
- No Budget: gray text

Do not use pills.
Do not use badges.
Do not use icons.
Do not add background fills.

4. SORTING AND FILTERING

Preserve existing table behavior.

The new columns:
- Variance % should be sortable
- Status should be sortable
- Status does not need custom filtering behavior beyond whatever the current default table supports

Do not add custom filter UIs.

5. EDITABILITY

Confirm and preserve:
- Budget editable where currently editable
- Consumed editable where currently editable
- Remaining read-only
- Variance read-only
- Variance % read-only
- Status read-only

6. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill behavior
- breadcrumb
- scope label
- dataset switching
- density controls
- layout
- styling beyond the simple text color treatment for Status

7. OUTPUT

After implementing, return:

1. COLUMN SET UPDATED
2. VARIANCE % ADDED
3. STATUS ADDED
4. STATUS RULES CONFIRMED
5. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.