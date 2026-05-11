You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not decide on your own what is redundant.
Do not preserve any Report Context field unless it is explicitly listed below as retained.
Do not change calculations.
Do not change control behavior.
Do not change drill behavior.
Do not change table behavior.

OBJECTIVE

Remove the large Report Context panel and replace it with a much more compact context treatment by explicitly removing fields that are already represented elsewhere on the page.

This is a redundancy removal and compaction pass.
Do not invent a new information model.
Follow the mapping below exactly.

REMOVE THE LARGE REPORT CONTEXT PANEL

1. Remove the entire bordered "Report Context" panel as it currently exists.

2. Do not preserve its structure, title, field layout, or definitions block.

EXPLICIT REDUNDANCY MAPPING

The following Report Context information is redundant because it is already shown elsewhere on the page and must be removed from the replacement context area:

1. Current View
Reason:
- already represented by the breadcrumb row
- already represented by the scope row

Remove it completely.

2. Facility Scope
Reason:
- already represented in the control bar as the Facility Scope control

Remove it completely.

3. Timeframe
Reason:
- already represented in the control bar as the Timeframe control

Remove it completely.

4. Metric
Reason:
- already represented in the control bar as the Metric control

Remove it completely.

5. Spend Mode
Reason:
- already represented in the control bar as the Spend Mode control

Remove it completely.

6. KPI Scope
Reason:
- already represented above the KPI row as:
  "KPI Summary represents: [value]"

Remove it completely from the replacement context area.

7. Drill Level
Reason:
- already implied by the breadcrumb and the scope row
- not necessary as separate visible UI

Remove it completely.

8. Selected item field
This includes any level-specific field such as:
- Facility
- Category
- Vendor
- Transaction

Reason:
- already represented by the breadcrumb endpoint
- already represented by the scope row

Remove it completely.

9. Definitions block
This includes:
- Variance = Budget - Consumed
- Variance % = Variance / Budget
- Actual = Posted spend only
- Commitment = Actual + committed spend
- Total Impact = Actual + committed + projected spend
- any PPD definition text

Reason:
- no longer justified as always-visible content
- consumes too much vertical space
- should not remain in the compact replacement area

Remove it completely from the always-visible area.

RETAIN ONLY THESE ITEMS IN THE NEW COMPACT CONTEXT STRIP

Create a compact replacement strip directly below the breadcrumb row and above the table.

The replacement strip must contain only:

1. Values reflect: [Spend Mode] spend, [Timeframe], in [Metric]
Reason:
- this is the one cross-control synthesis statement not already shown as a single combined sentence elsewhere

2. Reconciliation: Totals equal the sum of rows at the current level
Reason:
- this is a trust statement not otherwise shown elsewhere on the page

Do not include anything else in the compact strip.

PRESENTATION RULES

1. The new compact context strip must be:
- compact
- visually light
- lower emphasis than the KPI row
- lower emphasis than the table

2. Do not make it a large panel.

3. Do not add:
- icons
- badges
- pills
- helper text beyond the two required lines
- definitions
- section title
- borders that recreate the old panel pattern

PRESERVE THESE EXISTING ELEMENTS OUTSIDE THE NEW STRIP

Keep exactly as-is:
- control bar
- KPI Summary represents: [value]
- KPI row
- scope row
- breadcrumb row
- table
- row emphasis
- header continuity
- page layout except for removing the old panel and inserting the compact strip

OUTPUT

After implementing, return:

1. LARGE REPORT CONTEXT PANEL REMOVED
2. REDUNDANT FIELDS REMOVED EXACTLY AS SPECIFIED
3. COMPACT CONTEXT STRIP ADDED WITH ONLY THE TWO APPROVED LINES
4. KPI SCOPE LABEL ABOVE KPI ROW PRESERVED
5. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.