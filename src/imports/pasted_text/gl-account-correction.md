You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not redesign anything.
Do not change layout, spacing, styling, controls, KPI layout, breadcrumb styling, table structure, or interaction patterns.
Do not change calculations.
Do not add new UI elements.
Do not remove any UI elements.

OBJECTIVE

Correct the report so GL Account is not conflated with the older category model.

The report must use the governed GL Account model consistently across pivots and drill paths.

This is a data-model and labeling correction only.

CHANGES TO IMPLEMENT

1. REMOVE CATEGORY-STYLE REPRESENTATION WHERE GL ACCOUNT SHOULD BE USED

Where the report is currently showing category-style rows such as:
- Food
- Purchased Services
- similar category labels without GL codes

replace those with actual GL Account rows wherever the report is intended to represent GL Accounts.

Do not use category as a substitute for GL Account.

2. KEEP PIVOT BY OPTIONS AS-IS

Do not change the Pivot By control structure.

Keep:
- Facility
- GL Account
- Vendor

Do not add Category.
Do not relabel GL Account.

3. CORRECT THE FACILITY DRILL PATH

When Pivot By = Facility:

- top level rows should remain facilities
- drilling into a facility must show GL Accounts within that facility
- this level must not show the old category model

So the correct path is:

Facility -> GL Account -> Vendor -> Transactions

or

Facility -> GL Account -> Transactions

depending on the current prototype depth

4. ENSURE GL ACCOUNT ROWS USE THE CORRECT NAME FORMAT

Wherever rows represent GL Accounts, the Name column must display:

[GL Code] - [GL Account Name]

Examples:
- 6100 - Food Supplies
- 7200 - Medical Supplies
- 5400 - Housekeeping
- 8100 - Maintenance & Repair

Do not show bare category labels when the row entity is meant to be a GL Account.

5. KEEP THE GL ACCOUNT PIVOT CONSISTENT

When Pivot By = GL Account:
- continue to show GL Account rows directly
- ensure this matches the same GL model used inside facility drilldown

The GL Account pivot and the facility drilldown level must reference the same entity model.

6. UPDATE SCOPE LANGUAGE WHERE NEEDED

Where scope text currently implies category-based drilldown, update it to reflect GL Account-based drilldown.

Example:
- "Scope: GL Accounts within North Ridge"

This should stay aligned with the actual row entities being displayed.

Do not redesign the scope line.
Only correct the wording where necessary.

7. PRESERVE BREADCRUMB STRUCTURE WHILE CORRECTING ENTITY MEANING

Do not redesign the breadcrumb.

But ensure breadcrumb paths reflect the correct entity model.

If the user drilled from Facility into a GL Account, the breadcrumb should reflect the GL Account entity, not a category substitute.

8. DO NOT CHANGE NON-GL ENTITIES

Facilities should remain facilities.
Vendors should remain vendors.
Transactions should remain transactions.

Only correct the places where category is being incorrectly used instead of GL Account.

9. PRESERVE EVERYTHING ELSE

Do not change:
- control row
- KPI styling or layout
- table layout
- column labels
- sorting
- filters
- hover behavior
- drill interaction style
- numeric formatting
- excluded logic

OUTPUT

After implementing, return exactly:

1. CATEGORY-STYLE ROWS REPLACED WITH TRUE GL ACCOUNT REPRESENTATION WHERE REQUIRED
2. FACILITY DRILL NOW FLOWS TO GL ACCOUNTS, NOT CATEGORY
3. GL ACCOUNT NAME FORMAT STANDARDIZED TO [GL CODE] - [GL ACCOUNT NAME]
4. GL ACCOUNT PIVOT AND FACILITY DRILL NOW USE THE SAME ENTITY MODEL
5. SCOPE / BREADCRUMB LANGUAGE CORRECTED WHERE NEEDED
6. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.