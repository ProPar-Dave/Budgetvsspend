# Prompt 33 - Create a Supabase-Backed Prototype Database Layer

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change calculation logic.  
Do not change the existing payload contract the UI now expects.  
Do not introduce Vercel-specific assumptions or deployment setup.  
Do not replace the current UI with a new architecture.  

This is a **data-layer architecture and implementation pass only**.

Use the stack already appropriate to this environment:
- React
- TypeScript
- Tailwind CSS
- Supabase

Use Supabase as the database and persistence layer for the prototype.

---

## Objective

Prepare the prototype to move from an in-memory stubbed data layer to a **Supabase-backed prototype database** while preserving the current UI contract and behavior.

The goal of this pass is to:

1. Create a database structure that can support the current prototype
2. Preserve the comprehensive payload contract already established
3. Seed realistic prototype data
4. Add a typed data-access layer that can return the same payload shape the UI already consumes
5. Keep the UI behavior unchanged

This is for prototype support, not final production architecture.

---

## Source of Truth

The current UI expects a comprehensive payload with these logical domains:

- reportContext
- timeBuckets
- kpi
- rows
- meta

The database design must support generating that same payload shape.

Do not change the contract the UI now expects.

---

## Changes to Implement

### 1. Create a Supabase-Backed Data Model

Create a relational Supabase schema that can support the current Budget vs Spend prototype.

The schema must be able to represent, at minimum:

- report contexts
- time bucket definitions
- KPI values and reconciliation metadata
- row entities across pivots and drill levels
- row summary values
- row time bucket values
- exclusion state and exclusion metadata
- census context
- decomposition metadata
- aggregation metadata
- drill metadata
- trust / governance metadata
- transaction lineage where already represented in the prototype

Do not collapse everything into one table if that would make the structure brittle or hard to evolve.

---

### 2. Preserve the Existing Payload Contract

Add a typed data transformation layer that reads from Supabase and returns the same payload structure the UI currently expects.

That means the UI should still receive a payload shaped like:

- reportContext
- timeBuckets
- kpi
- rows
- meta

Do not force the UI to consume raw database tables directly.

Do not rename payload fields.

---

### 3. Add TypeScript Types That Mirror the Contract

Create or refine TypeScript types so that:

- database-facing types are explicit
- payload-facing types are explicit
- transformation between database records and UI payload is typed and traceable

The payload-facing types must remain aligned with the current contract already established in the prototype.

---

### 4. Seed Realistic Prototype Data

Populate the Supabase-backed prototype database with enough realistic seed data to support the current Budget vs Spend prototype.

The seed data must support:

- Facility pivot
- GL Account drill
- governed time buckets
- Full Timeframe and bucketed views
- exclusion cases
- Actual / Commitment / Total Impact modes
- transaction-linked spend behavior
- mixed census context where applicable

Seed data should be realistic enough to support prototype review and interaction, but it does not need to model the full production domain yet.

---

### 5. Preserve Current UI Behavior

The UI must continue to behave the same way after this pass.

Do not change:

- control bar layout or behavior
- breadcrumb behavior
- KPI card layout
- table layout
- sticky behavior
- scrolling behavior
- filtering or sorting behavior
- drill behavior
- overlay behavior
- spend mode behavior
- timeframe behavior
- Breakdown By behavior

Only replace the backing data source and binding path.

---

### 6. Keep Calculation Logic Stable

Do not rewrite or reinterpret calculation behavior in this pass.

If the UI currently expects values such as:

- summary.budget
- summary.consumed
- summary.variance
- summary.percent
- timeBuckets[W1].total
- timeBuckets[W1].actual
- timeBuckets[W1].commitment

then the data layer must provide those values in the same way the UI already expects.

This pass is not for moving business logic into SQL or redefining formulas.

---

### 7. Preserve Governed Metadata

Ensure the Supabase-backed structure can preserve and return:

- calculationEngineVersion
- kernelVersion
- governance flags
- spend rules
- time rules
- exclusion metadata
- decomposition metadata
- lineage metadata

Even if some of these are not yet fully surfaced in the UI, they must remain available through the payload.

---

### 8. Preserve Transaction Traceability

Where the current prototype represents transactions, ensure the database structure can support:

- PO reference
- Invoice reference
- missing-state representation
- transaction lineage through drill and time-bucketed views

A row with spend must still remain traceable to valid transaction information through the payload.

---

### 9. Keep the Integration Prototype-Safe

This is still a prototype.

So:

- do not add production auth workflows unless already required by the environment
- do not build a full admin backend
- do not add unrelated CRUD UI
- do not redesign around database management

The goal is a clean Supabase-backed prototype support layer.

---

### 10. Replace Stub Usage Cleanly

Where the UI is currently reading from in-memory stubbed data, refactor it so the same views can be driven by the Supabase-backed source through the new typed transformation layer.

Do not leave conflicting duplicate sources of truth in place.

The prototype should have one clear data path.

---

## Preserve

- Existing UI structure
- Existing interaction model
- Existing payload contract
- Existing visual design
- Existing calculation behavior
- Existing drill model
- Existing sort and filter behavior
- Existing sticky and overflow behavior

---

## Output

Respond with:

1. What Supabase tables or logical entities were created  
2. How the database maps back to the existing payload contract  
3. Confirmation that typed transformation layers were added  
4. Confirmation that realistic seed data was added  
5. Confirmation that the UI now reads from the Supabase-backed path instead of only in-memory stubs  
6. Confirmation that the existing payload contract was preserved  
7. Confirmation that no calculation logic was changed  
8. Confirmation that no layout, structure, or behavior was changed  

Do not propose next steps.  
Stop after reporting changes.