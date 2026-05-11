You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change control behavior.
Do not change option sets.
Do not change page hierarchy.
Do not change breadcrumb, KPI row, table, or layout outside the control row.

OBJECTIVE

Bring the control row closer to the provided target by improving spacing, proportions, and visual polish, while removing the blue non-default state treatment.

This is a visual refinement pass for the control row only.

CHANGES TO IMPLEMENT

1. REMOVE THE BLUE NON-DEFAULT STATE

Remove the current blue non-default styling from the context controls.

This includes:
- blue label color
- blue border treatment
- any blue emphasis tied to non-default values

All context controls should use the same neutral visual style regardless of whether the selected value is default or non-default.

Do not change the selected values themselves.
Do not change behavior.

2. MATCH THE TARGET CONTROL PROPORTIONS MORE CLOSELY

For the three primary context controls on the left:
- Timeframe
- Metric
- Spend Mode

refine them so they feel closer to the target image in proportion.

Requirements:
- slightly larger and more confident than the current implementation
- more generous internal padding than now
- consistent height across all three
- balanced width to content ratio
- cleaner visual rhythm across the row

Do not make them oversized.
The goal is refined and intentional, not bulky.

3. IMPROVE LABEL STYLING

For the labels above each control:
- keep them visible
- make them feel polished and intentional
- ensure they are subordinate to the selected value
- use a neutral color, not blue
- keep size and spacing visually aligned across all controls

4. IMPROVE VALUE STYLING

For the selected values:
- make them feel visually strong and easy to scan
- ensure the three primary controls read as one cohesive set
- keep value styling neutral and clean
- avoid making one control feel heavier than the others unless the content itself requires it

5. REFINE BORDER, RADIUS, AND CHEVRON CONSISTENCY

Across all controls:
- use one consistent border treatment
- use one consistent corner radius
- ensure chevrons are aligned consistently
- ensure chevrons are visually quiet but clear
- remove any sense that one control belongs to a different visual system than the others

6. IMPROVE HORIZONTAL SPACING AND GROUPING

Refine the spacing so the row reads as:

left group:
- Timeframe
- Metric
- Spend Mode

right group:
- Table Size

Requirements:
- the three left controls should feel tightly and intentionally grouped
- Table Size should feel clearly separate and secondary
- the overall row should feel balanced across the full width
- avoid awkward empty space inside the left group
- avoid making Table Size feel detached or floating

7. KEEP TABLE SIZE SUPPORTIVE

Keep Table Size visually subordinate to the three primary context controls.

It should:
- follow the same visual style system
- remain slightly more secondary in emphasis
- not compete with the primary analytical controls

Do not reduce its usability.

8. DO NOT CHANGE ANYTHING ELSE

Do NOT change:
- control labels
- selected values
- interactions
- breadcrumb
- scope
- KPI row
- table
- page layout outside this control row

9. OUTPUT

After implementing, return:

1. BLUE NON-DEFAULT STATE REMOVED
2. PRIMARY CONTROL PROPORTIONS REFINED
3. LABEL / VALUE STYLING IMPROVED
4. BORDER / RADIUS / CHEVRON CONSISTENCY IMPROVED
5. LEFT / RIGHT GROUP SPACING REFINED
6. TABLE SIZE KEPT SUPPORTIVE
7. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.