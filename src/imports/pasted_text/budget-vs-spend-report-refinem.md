You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not invent behavior.
Do not change calculations.
Do not change the control row.
Do not change breadcrumb styling unless explicitly instructed below.
Do not change KPI values or their meaning.
Do not redesign the page.
Do not introduce new panels, drawers, cards, modals, or helper sections.
Do not change layout outside the table and its immediate drill interaction behavior.

OBJECTIVE

Refine the Budget vs Spend report’s primary table so the drill interaction feels clear, trustworthy, and continuous for a multi-facility superuser.

This is a table and drill behavior refinement pass only.

The table must feel like one continuous analytical surface where drilldown progressively narrows scope without changing meaning.

CHANGES TO IMPLEMENT

1. PRESERVE THE SINGLE-TABLE MODEL

Keep one table component.

Do not create separate views or visually distinct table variants for:

* Facilities
* Categories
* Vendors
* Transactions

The same table should remain in place while the row dataset changes based on drill depth.

2. REINFORCE DRILLABLE ROW AFFORDANCE

For drillable rows only:

* preserve full-row click behavior
* ensure hover state is clearly visible but restrained
* ensure pointer cursor appears
* make the row feel interactive without making it feel like a button

For non-drillable rows:

* remove any misleading interactive affordance
* do not show pointer cursor
* do not imply clickability

3. PRESERVE COLUMN STABILITY

Do not change:

* column order
* column labels
* column meaning

Keep the first column labeled:

* Name

Do not rename the first column by level.
Do not change it to Facility, Category, Vendor, or Transaction.

Context must come from breadcrumb, not from changing headers.

4. MAKE DRILL FEEL LIKE NARROWING, NOT NAVIGATION

Refine the visual behavior so drilling feels like:

* the same report
* the same table
* a narrower scope

Do not make drill feel like:

* a page transition
* a route change
* a new report
* a modal detail view

5. STRENGTHEN BREADCRUMB-TABLE RELATIONSHIP

Without redesigning the breadcrumb, ensure the table visually reads as the child of the breadcrumb context.

The user should feel:

* breadcrumb defines current scope
* table displays the rows for that scope

Do not add explanatory text.
Do not add a new context strip.

6. PRESERVE KPI-TO-TABLE CONTINUITY

Do not redesign the KPI row.

But ensure the spacing and visual relationship between:

* breadcrumb
* scope line
* KPI row
* table

still reads as one continuous context-to-data flow.

7. MAINTAIN READ-ONLY TABLE BODY

The body must continue to feel read-only.

Do not introduce:

* editable-looking cells
* input styling
* inline controls in rows
* row action menus unless already present

8. KEEP EXCEPTION EMPHASIS INTACT

Preserve current hierarchy where:

* Over Budget rows are strongest
* No Budget rows are distinct
* Healthy rows are quieter

Do not increase visual noise.
Do not over-style healthy rows.

9. TRANSACTION LEVEL MUST STILL FEEL LIKE THE SAME TABLE

If the prototype already includes transaction depth, keep it visually consistent with the parent levels.

Do not make the transaction level feel like a separate ledger screen.
It must still feel like the same analytical table at the deepest scope.

10. PRESERVE EVERYTHING ELSE

Do NOT change:

* top control row
* control labels
* control behavior
* breadcrumb content
* KPI values
* page hierarchy
* overall page layout
* calculation semantics

OUTPUT

After implementing, return exactly:

1. SINGLE-TABLE MODEL PRESERVED
2. DRILLABLE VS NON-DRILLABLE ROW AFFORDANCE REFINED
3. COLUMN STABILITY PRESERVED
4. DRILL INTERACTION MADE MORE CONTINUOUS
5. BREADCRUMB-TO-TABLE RELATIONSHIP STRENGTHENED
6. READ-ONLY TABLE BODY PRESERVED
7. EXCEPTION EMPHASIS PRESERVED
8. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.
