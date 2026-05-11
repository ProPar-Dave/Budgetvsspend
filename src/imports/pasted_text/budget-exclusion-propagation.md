You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not redesign anything.
Do not change layout, spacing, styling, hierarchy, or interaction patterns.
Do not change control row, breadcrumb, KPI row, or table structure.
Do not add new UI elements.
Do not remove any UI elements.
Do not change calculations except as explicitly described below.

OBJECTIVE

Ensure exclusion propagates correctly through drilldown.

If a GL is excluded from budget impact, then all downstream rows whose budget meaning is derived from that excluded GL must also be treated as excluded from budget impact.

Spend must remain visible for transparency, but budget-impact fields must remain excluded throughout the full drill path.

This is a logic and presentation consistency pass only.

CHANGES TO IMPLEMENT

1. PROPAGATE EXCLUSION FROM GL TO ALL DOWNSTREAM LEVELS

If a GL row is excluded, then every downstream row reached by drilling into that GL must also be treated as excluded from budget impact.

This includes downstream rows such as:
- vendors within that GL
- transactions within those vendors
- invoices within that excluded GL path
- POs within that excluded GL path, if shown

This rule applies only when the downstream row belongs to that excluded GL path.

2. PRESERVE EXCLUDED PRESENTATION AT EVERY LEVEL

For excluded rows at any level:
- Budget must display: Excluded
- Spend must remain visible as a normal value
- Variance must display: --
- % must display: --

Do not show numeric budget, variance, or percent values for excluded rows.

3. KEEP EXCLUDED TREATMENT NEUTRAL

Excluded rows must remain passive and informational.

For excluded rows:
- do not use warning styling
- do not use error styling
- do not use attention-grabbing accents
- do not make excluded look like a problem requiring action

Excluded should read as intentional, neutral, and non-applicable for budget impact.

4. PRESERVE DRILL CONTINUITY

When drilling from an excluded GL into downstream levels:
- the user must continue to see excluded treatment consistently
- excluded state must not disappear at vendor or transaction level
- the report must still feel like one continuous analytical surface

5. DO NOT ALLOW EXCLUDED PATHS TO RE-ENTER BUDGET LOGIC

For downstream rows under an excluded GL:
- do not restore numeric budget values
- do not calculate variance
- do not calculate percentage
- do not show budget health status such as Healthy or Over Budget for that excluded path unless a separate neutral excluded state already exists

Excluded budget paths must remain excluded for all downstream budget-impact presentation.

6. PRESERVE SPEND VISIBILITY

Even when excluded:
- spend must continue to display normally
- excluded rows must remain visible in the table
- excluded rows must still appear in drilldown

Do not hide excluded financial activity.

7. DO NOT CHANGE NON-EXCLUDED LOGIC

Rows that are not part of an excluded GL path must remain unchanged.

Do not alter:
- numeric budget values
- variance calculations
- percent calculations
- health status logic
- drill behavior for non-excluded paths

8. PRESERVE EVERYTHING ELSE

Do not change:
- control row
- breadcrumb styling
- KPI layout
- table layout
- column order
- column labels
- hover behavior
- sorting affordances
- filters
- spacing
- typography
- colors for non-excluded rows

OUTPUT

After implementing, return exactly:

1. GL-LEVEL EXCLUSION NOW PROPAGATES THROUGH DOWNSTREAM DRILL PATHS
2. EXCLUDED PRESENTATION APPLIED CONSISTENTLY AT ALL LEVELS
3. SPEND REMAINS VISIBLE FOR EXCLUDED ROWS
4. BUDGET, VARIANCE, AND % REMAIN NON-APPLICABLE FOR EXCLUDED PATHS
5. NON-EXCLUDED ROWS REMAIN UNCHANGED
6. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.