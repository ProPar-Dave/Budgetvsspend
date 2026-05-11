You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not redesign the UI.
Do not change layout, spacing, styling, hierarchy, or interaction patterns.
Do not change control labels, KPI structure, breadcrumb structure, table structure, or drill model.
Do not add new UI elements unless required to support clean data binding behind the scenes.
Do not leave old mock values in place as fallback content.

OBJECTIVE

Separate the data layer from the UI cleanly so the prototype renders from a stubbed database-style data source instead of embedded mock values.

The goal is to make the UI and data independently refinable.

This is a data architecture and binding cleanup pass only.

CHANGES TO IMPLEMENT

1. REMOVE HARDCODED MOCK DATA FROM THE UI

Remove embedded / hardcoded mock values from the UI layer wherever possible.

This includes hardcoded content such as:
- KPI values
- breadcrumb values
- scope text
- table row labels
- table cell values
- excluded examples
- drilldown example values
- pivot-specific example values

Do not leave old mock values sitting directly inside UI components if those components should be data-driven.

2. CREATE A SINGLE STUBBED DATA SOURCE

Replace embedded mock values with one structured stubbed data source that behaves like a lightweight database or governed fixture layer.

The stubbed data source must be the single source for:
- facilities
- GL Accounts
- vendors
- transactions / invoices
- KPI values
- excluded states
- spend mode results
- metric-mode results
- pivot permutations
- drilldown states
- timeframe / view-by permutations where applicable

3. BIND THE UI TO THE STUBBED DATA SOURCE

Ensure the UI renders from the stubbed data source rather than from hardcoded display values.

This applies to:
- top-level report states
- drill states
- pivot changes
- excluded-row treatment
- KPI summaries
- breadcrumb content
- scope line content
- table rows and values

4. REMOVE OLD MOCK DATA PERSISTENCE

Ensure old mock data does not continue to appear because of:
- leftover hardcoded UI values
- fallback values inside components
- duplicate fixture sources
- stale example rows not connected to the new stubbed data source

The prototype should not mix:
- old embedded mock data
- new stubbed data

The stubbed data source must fully replace the old mock data path.

5. KEEP THE DATA LAYER EASY TO REFINE INDEPENDENTLY

Structure the stubbed data source so it can be refined independently from the UI.

It should be easy to update:
- row values
- excluded examples
- drill examples
- pivot examples
- timeframe examples
- PPD vs dollar examples
- actual vs commitment vs total impact examples

without rewriting UI structure.

6. PRESERVE CURRENT UI AND INTERACTION BEHAVIOR

Do not change:
- control row design
- breadcrumb design
- KPI layout
- table layout
- sorting behavior
- filtering behavior
- drill interaction style
- excluded presentation rules
- status styling
- number-formatting rules

Only change how the data is sourced and bound.

7. PRESERVE CURRENT REPORT LOGIC MODEL

The stubbed data must still support the same governed reporting concepts already established, including:
- Pivot By permutations
- Metric modes
- Spend modes
- excluded-path propagation
- drill continuity
- GL Account consistency
- KPI / table consistency

Do not simplify away these behaviors.

8. MAKE THE STUBBED DATA LAYER CLEARLY SEPARATE FROM PRESENTATION

The final structure should make it clear that:
- UI components are presentation
- stubbed data is the source
- presentation does not own the data

This separation should support future refinement of the data model without requiring UI redesign.

OUTPUT

After implementing, return exactly:

1. HARDCODED MOCK DATA REMOVED FROM UI COMPONENTS
2. SINGLE STUBBED DATA SOURCE CREATED
3. UI NOW BINDS TO THE STUBBED DATA SOURCE
4. OLD MOCK DATA NO LONGER PERSISTS AS FALLBACK CONTENT
5. DATA LAYER CAN NOW BE REFINED INDEPENDENTLY OF THE UI
6. CONFIRM NO UI REDESIGN OR BEHAVIOR CHANGES

Do not propose next steps.
Stop after reporting changes.