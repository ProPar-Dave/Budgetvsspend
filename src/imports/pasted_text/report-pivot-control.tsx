You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not redesign the page.
Do not change layout, spacing, typography, colors, borders, or overall page hierarchy except where explicitly instructed below.
Do not change calculations.
Do not change KPI layout.
Do not change table structure, column order, or interaction model except where explicitly instructed below.
Do not introduce extra panels, helper text, or explanatory sections.

OBJECTIVE

Add a control that allows the user to switch the current report permutation, like a pivot table, while preserving the same reporting surface.

This report must remain one report with multiple investigative permutations.
For this pass, add the ability to switch the table view by pivot dimension.

CHANGES TO IMPLEMENT

1. ADD A NEW CONTROL TO SWITCH THE REPORT PERMUTATION

Add one new control to the existing top control row.

Label it:
Pivot By

This control must allow the user to switch the current table permutation.

Use the same visual language as the existing top-row controls.

Do not create a new section for it.
Do not redesign the control row.
Integrate it into the existing control row cleanly.

2. PIVOT BY CONTROL OPTIONS

The Pivot By control must include these options:

- Facility
- GL Account
- Vendor

Refer to it exactly as:
GL Account

Do not use:
- Category
- Category / GL
- Category / GL Group

3. PRESERVE THE SAME REPORT SURFACE

Switching Pivot By must NOT:
- create a new page
- create a new table component
- create a new report type
- change KPI layout
- change control row structure beyond the addition of this one control

The same report surface must remain in place.
Only the current data permutation changes.

4. DEFINE HOW EACH PIVOT OPTION CHANGES THE TABLE

When Pivot By = Facility:
- each row represents a facility

When Pivot By = GL Account:
- each row represents a GL Account
- the Name column values must display:
  [GL Code] - [GL Account Name]

Examples:
- 6100 - Food Supplies
- 7200 - Medical Supplies
- 5400 - Housekeeping

When Pivot By = Vendor:
- each row represents a vendor

Keep the first column header exactly as:
Name

Do not rename the column header by pivot state.

5. PRESERVE TABLE STRUCTURE

Do not change:
- column order
- column widths
- column labels
- sorting affordances
- filter row structure

Budget, Spend, Variance, %, and Status must remain structurally the same across all pivot states.

Only the row entities and corresponding values change based on the selected pivot.

6. PRESERVE KPI STRUCTURE AND LOGIC

Do not change KPI layout or styling.

KPI values must remain consistent with the selected:
- Timeframe
- Metric
- Spend Mode

Switching Pivot By changes the table permutation, not the underlying reporting model.

7. PRESERVE DRILL MODEL, BUT MAKE IT COMPATIBLE WITH THE SELECTED PIVOT

Do not redesign drill interaction.

Keep the same drill behavior pattern already established.

However, the drill path must begin from the selected pivot dimension.

Examples:

If Pivot By = Facility:
- Facility -> GL Account -> Vendor -> Transactions
or
- Facility -> Vendor -> Transactions

If Pivot By = GL Account:
- GL Account -> Vendor -> Transactions
or
- GL Account -> Facility -> Transactions

If Pivot By = Vendor:
- Vendor -> Facility -> Transactions
or
- Vendor -> GL Account -> Transactions

Do not add explanatory text for these paths in the UI.
Just ensure the presented state is compatible with the chosen pivot.

8. UPDATE BREADCRUMB VALUES AS NEEDED

Do not redesign the breadcrumb.
Do not restyle the breadcrumb.

Allow breadcrumb values to reflect the current pivot context and drill path as needed.

9. PRESERVE ALL OTHER BEHAVIOR AND VISUALS

Do not change:
- Timeframe control
- Metric control
- Spend Mode control
- Table Size control
- breadcrumb styling
- scope line styling
- KPI styling
- table container styling
- numeric formatting
- status coloring
- hover behavior
- spacing outside the addition of the new Pivot By control

OUTPUT

After implementing, return exactly:

1. PIVOT BY CONTROL ADDED
2. FACILITY, GL ACCOUNT, AND VENDOR OPTIONS ADDED
3. TABLE NOW CHANGES BY SELECTED PIVOT PERMUTATION
4. NAME COLUMN VALUES UPDATED APPROPRIATELY FOR EACH PIVOT
5. DRILL MODEL MADE COMPATIBLE WITH SELECTED PIVOT
6. CONFIRM NO OTHER UI OR LAYOUT CHANGES

Do not propose next steps.
Stop after reporting changes.