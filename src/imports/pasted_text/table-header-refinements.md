You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change calculations.
Do not change values.
Do not change table behavior.
Do not change filter behavior.
Do not change layout structure beyond the header refinements explicitly requested below.

OBJECTIVE

Simplify the table headers and improve scan alignment across the full header row.

CHANGES TO IMPLEMENT

1. RENAME "CONSUMED" TO "SPEND"

Change the table column header:
- Consumed

to:
- Spend

Do not change the underlying values, calculations, or logic.
This is a label change only.

2. REMOVE THE VARIANCE SUBLABEL

In the Variance column header, remove:
- (Budget - Consumed)

The header should read only:
- Variance

Do not change the meaning or calculations.

3. SIMPLIFY THE VARIANCE % HEADER

Change the Variance % column header from:
- Variance %
- with sublabel: (of Budget)

to:
- %

Remove the "(of Budget)" sublabel entirely.

Do not change the meaning or calculations.

4. ALIGN ALL HEADER LABELS TO THE TOP

Make all column headers align to the same top scan line.

Requirements:
- all primary header labels should share the same top alignment
- no header should appear vertically centered lower than the others
- Name, Budget, Spend, Variance, %, and Status should all follow the same top visual line

5. REBALANCE THE % COLUMN WIDTH

Because the header is now just:
- %

reduce the width of that column so it is more appropriately matched to the short values it contains.

Do not make it cramped, but do not leave it oversized.

6. PRESERVE HEADER/BODY ALIGNMENT

Keep the header, filter row, and body column alignment intact after these changes.

Do not let the simplified headers break the shared column geometry.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- control bar
- KPI row
- breadcrumb
- scope line
- compact context strip
- row emphasis
- table body styling
- values
- calculations
- page layout

8. OUTPUT

After implementing, return:

1. CONSUMED RENAMED TO SPEND
2. VARIANCE SUBLABEL REMOVED
3. VARIANCE % HEADER SIMPLIFIED TO %
4. HEADER TOP ALIGNMENT APPLIED
5. % COLUMN WIDTH REBALANCED
6. ALIGNMENT PRESERVED
7. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.