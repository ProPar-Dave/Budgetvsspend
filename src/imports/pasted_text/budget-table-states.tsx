You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new UI beyond what is explicitly described.
Do not change controls, layout, or styling unless instructed.

You are now adding foundational table states to the Budget vs Spend prototype.

OBJECTIVE

Introduce the minimum required non-happy-path states so the table can represent realistic reporting conditions.

After this step, the prototype must support these state types:

- Empty state
- Loading state
- Error state
- No Budget row-level state

Do not add Missing Census yet.
Do not add projection messaging yet.
Do not add new controls.

CHANGES TO IMPLEMENT

1. ADD A SIMPLE VIEW STATE SWITCH

Add a temporary local/demo state that controls which top-level table state is shown.

Use exactly these values:

- "default"
- "loading"
- "empty"
- "error"

You may implement this as a simple local constant or local state in the prototype for now.

Default behavior:
- use "default" initially

Do not add persistence.
Do not add backend logic.

2. ADD LOADING STATE

When view state is:
- "loading"

Replace the table body area with a simple loading presentation.

Requirements:
- keep the table header visible
- show 3 placeholder rows
- placeholders should align to the existing columns
- use simple skeleton-style blocks or neutral placeholder bars
- do not use a spinner
- do not change controls, breadcrumb, or scope label

3. ADD EMPTY STATE

When view state is:
- "empty"

Replace the table body area with a simple empty message.

Render exactly this text:
- No results found for the current scope.

Below it, render exactly this text:
- Try changing your filters or returning to a higher level.

Requirements:
- keep the table header visible
- do not add icons
- do not add buttons
- do not add illustrations

4. ADD ERROR STATE

When view state is:
- "error"

Replace the table body area with a simple error message.

Render exactly this text:
- The report could not be loaded.

Below it, render exactly this text:
- Try again later.

Requirements:
- keep the table header visible
- do not add icons
- do not add buttons
- do not add illustrations

5. ADD ROW-LEVEL "NO BUDGET" CASE TO EXISTING DATA

Update exactly one existing row in the LEVEL_1 dataset so it represents a no-budget case.

Use:
- Purchased Services

Set its values to exactly:
- budget: 0
- consumed: 3000
- variance: -3000

Do not change the row name.

This row must continue to appear in the default dataset at LEVEL_1.

6. PRESERVE STATUS RULES

Keep the existing temporary Status rules exactly as they are:

- "Over Budget" when variance < 0
- "Healthy" when variance >= 0 and remaining > 0
- "No Budget" when budget === 0

Do not change the rule order unless required for correct rendering of the no-budget row.
The final rendered status for Purchased Services must be:
- No Budget

7. PRESERVE ALL EXISTING BEHAVIOR

Do NOT change:
- drill state shape
- drill depth
- dataset switching by level
- breadcrumb behavior
- row click behavior
- columns
- sorting
- filtering
- density controls
- overall layout
- styling beyond what is needed for the new state presentations

8. OUTPUT

After implementing, return:

1. VIEW STATES ADDED
2. LOADING STATE ADDED
3. EMPTY STATE ADDED
4. ERROR STATE ADDED
5. NO BUDGET ROW ADDED
6. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.