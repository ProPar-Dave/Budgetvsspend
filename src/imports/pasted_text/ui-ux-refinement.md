You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change calculations.
Do not change values.
Do not change breadcrumb behavior.
Do not change table behavior.

OBJECTIVE

Simplify and compact the top of the page by removing redundant controls, removing unnecessary framing around the viewport, and reducing the size of the remaining top controls while preserving clarity and prominence.

CHANGES TO IMPLEMENT

1. REMOVE THE FACILITY SCOPE CONTROL ENTIRELY

Remove the full Facility Scope control from the control bar.

Explicit redundancy reason:
- the currently viewed facility / context is already represented by the breadcrumb
- the breadcrumb is now the primary orientation device
- keeping Facility Scope creates duplicate context in the top bar

Do not preserve Facility Scope elsewhere in the top bar.
Do not replace it with another context label in this step.

2. KEEP THE REMAINING REPORT CONTROLS

Preserve these controls:
- Timeframe
- Metric
- Spend Mode

Do not change their option sets or behavior in this step.

3. MAKE THE REMAINING REPORT CONTROLS MORE COMPACT

Reduce the vertical size of the remaining controls while preserving visual prominence.

Requirements:
- controls should be smaller than they are now
- labels remain visible and subordinate
- selected values remain primary and readable
- controls should still feel like intentional analytical selectors, not plain text

Do not make them tiny or weak.
This is compaction, not de-emphasis.

4. MOVE DENSITY CONTROLS INTO THE SAME TOP CONTROL BAND

The density controls:
- Comfortable
- Standard
- Compact

should become a compact subsection of the same overall top control row.

Requirements:
- they should visually read as supporting controls, not the primary report controls
- they should not dominate the row
- they should feel integrated into the same top band rather than floating in their own separate area

Do not change their behavior.

5. REMOVE OUTER FRAMING / UNUSED EDGE SPACE

Remove the unnecessary stroke/frame effect and wasted padding between the viewport edge and the actual page content.

Goals:
- reduce the feeling that the page is sitting inside an extra box
- let the reporting surface use the available canvas more directly
- tighten the relationship between viewport and content

Do not make the layout cramped.
Just remove unnecessary outer framing and wasted edge space.

6. RETIGHTEN THE TOP STACK AFTER THESE REMOVALS

After removing Facility Scope and compacting the controls:
- tighten the spacing between the top control band and the breadcrumb
- ensure the top of the page feels intentional and efficient
- preserve clarity and hierarchy

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- breadcrumb text or behavior
- scope line
- KPI summary values
- table
- row emphasis
- header/body alignment
- calculations
- page logic

8. OUTPUT

After implementing, return:

1. FACILITY SCOPE CONTROL REMOVED
2. REMAINING REPORT CONTROLS COMPACTED
3. DENSITY CONTROLS INTEGRATED INTO SAME TOP BAND
4. OUTER FRAMING / EDGE WASTE REMOVED
5. TOP STACK RETIGHTENED
6. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.