You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change calculations.
Do not change KPI values.
Do not change labels.
Do not change control behavior.
Do not change breadcrumb behavior.
Do not change table behavior.

OBJECTIVE

Remove the compact context strip and reposition the KPI summary so it sits directly beneath the breadcrumb/scope layer, because the KPI summary is a child of the context represented by the breadcrumb.

CHANGES TO IMPLEMENT

1. REMOVE THE COMPACT CONTEXT STRIP ENTIRELY

Remove the full compact strip containing:
- Values reflect: [Spend Mode] spend, [Timeframe], in [Metric]
- Reconciliation: Totals equal the sum of rows at the current level

Do not preserve this strip elsewhere in this step.
Do not rewrite it.
Do not collapse it into another line.

2. MOVE THE KPI SUMMARY AREA BELOW THE BREADCRUMB/SCOPE LAYER

Reorder the page structure so that:

- control bar remains first
- breadcrumb remains the primary orientation line
- scope remains directly beneath the breadcrumb
- KPI summary then appears directly below that breadcrumb/scope context
- table follows after the KPI summary

3. KEEP THE KPI SUMMARY CONTENT EXACTLY AS-IS

Preserve:
- Total Budget
- Total Consumed / Spend label if already renamed
- Total Variance
- Variance %

Do not change:
- values
- calculations
- inline presentation style
- label wording

4. REMOVE THE OLD KPI PLACEMENT

Do not leave the KPI summary in its previous location above the breadcrumb/scope layer.

There should be only one KPI summary area, in the new location beneath the breadcrumb/scope context.

5. PRESERVE THE CONTEXT HIERARCHY

The visual reading order should now be:

- Controls
- Breadcrumb
- Scope
- KPI summary
- Table

This should make it clear that the KPIs summarize the currently viewed context.

6. DO NOT ADD NEW UI

Do NOT add:
- new context lines
- replacement helper text
- dividers
- icons
- cards
- badges
- titles

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- control bar
- breadcrumb styling
- scope text
- table
- row emphasis
- header/body alignment
- page layout except for removing the context strip and moving the KPI summary

8. OUTPUT

After implementing, return:

1. COMPACT CONTEXT STRIP REMOVED
2. KPI SUMMARY MOVED BELOW BREADCRUMB/SCOPE
3. KPI CONTENT PRESERVED
4. OLD KPI PLACEMENT REMOVED
5. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.