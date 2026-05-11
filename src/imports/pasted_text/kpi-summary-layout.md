You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change calculations.
Do not change KPI values.
Do not change labels.
Do not change control behavior.
Do not change breadcrumb behavior.
Do not change table behavior.

OBJECTIVE

Change the KPI presentation from separate card-like blocks into a single inline horizontal summary row so the values are easier to scan left to right, similar to an executive summary strip.

This is a layout and presentation change only.
Do not change the underlying KPI content or logic.

CHANGES TO IMPLEMENT

1. REMOVE CARD-LIKE KPI CONTAINERS

Remove the current grid/card treatment where each KPI sits inside its own boxed block or reserved card area.

Do not preserve equal card widths.

2. REBUILD THE KPI AREA AS ONE INLINE SUMMARY ROW

Render the KPI metrics in a single horizontal sequence, one after another, in this exact order:

- Total Budget
- Total Consumed
- Total Variance
- Variance %

3. EACH KPI SHOULD USE A COMPACT STACK

Within the inline row, each KPI should appear as a compact vertical pair:

- label on top
- value directly beneath

Example structure:

Total Budget
$7,000

Total Consumed
$7,100

Total Variance
-$100

Variance %
-1%

4. DO NOT FORCE A GRID

Requirements:
- do not assign equal-width blocks to each KPI
- do not stretch each KPI to fill a 4-column grid
- allow each KPI grouping to size more naturally to its content
- maintain consistent spacing between KPI groupings

The goal is an inline scan row, not a dashboard card row.

5. KEEP THE ROW HORIZONTALLY SCANNABLE

Requirements:
- all KPI groupings should sit on one horizontal line when space allows
- use consistent horizontal spacing between KPI groups
- the row should feel like a compact summary strip
- values should be the dominant visual element
- labels should remain supportive

6. PRESERVE KPI SCOPE RELATIONSHIP

Keep the existing KPI scope context exactly as-is.
Do not remove or rewrite the line that explains what the KPI summary represents unless separately instructed.

The new inline KPI row should sit naturally beneath that scope line.

7. DO NOT ADD NEW UI PATTERNS

Do NOT add:
- new cards
- separators between each KPI
- icons
- badges
- helper text
- charts
- sparklines

A simple inline summary treatment only.

8. PRESERVE EVERYTHING ELSE

Do NOT change:
- KPI values
- KPI labels
- calculations
- control bar
- breadcrumb
- scope line
- compact context strip
- table
- row emphasis
- page layout beyond changing the KPI presentation from block/grid to inline summary row

9. OUTPUT

After implementing, return:

1. KPI CARDS REMOVED
2. KPI AREA REBUILT AS INLINE SUMMARY ROW
3. EQUAL-WIDTH GRID TREATMENT REMOVED
4. HORIZONTAL SCANABILITY IMPROVED
5. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.