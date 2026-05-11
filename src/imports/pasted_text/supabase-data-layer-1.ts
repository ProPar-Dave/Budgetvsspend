# Prompt 34 - Connect Supabase Through the Prepared Data Layer

You are still in STRICT EXECUTION MODE.

## Constraints

Do not make assumptions.
Do not redesign anything.
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.
Do not change the existing UI payload contract.
Do not change calculation logic.
Do not bypass the repository / adapter boundary that was just created.
Do not remove the LocalAdapter fallback until the Supabase-backed path is working.

This is a Supabase connection and data-path implementation pass only.

Use the stack already appropriate to this environment:
- React
- TypeScript
- Tailwind CSS
- Supabase

## Objective

Connect the prototype to a real Supabase project through the prepared architecture so that the UI can read report data from Supabase while preserving the exact `ReportView` contract and existing behavior.

This pass must:
1. connect Supabase as the backing data source
2. implement a `SupabaseAdapter` behind the existing repository boundary
3. preserve the existing payload contract
4. preserve the LocalAdapter as a fallback or temporary comparison path until the Supabase-backed path is validated
5. keep all current UI behavior unchanged

## Important Implementation Guidance

Figma Make is now in the **Supabase connection phase**.

If the backend is not yet connected in this file:
- prompt for the Supabase connection through Figma Make's backend integration flow
- once connected, continue implementation using the existing prepared architecture

Do not stop after requesting connection if the environment allows continuing.

Do not discard the prepared files and abstractions from the preparation phase.

## Changes to Implement

### 1. Connect Supabase Through the Existing Architecture

Use the already prepared data layer architecture:
- database-facing types
- payload-facing types
- transformation layer
- repository / adapter boundary

Add a Supabase-backed implementation that fits into this structure.

Do not make the UI call Supabase directly.

---

### 2. Add a Supabase Adapter

Create a concrete adapter implementation, such as:

- `SupabaseAdapter`

It must implement the same repository interface already used by the UI.

Responsibilities should include:
- reading report-context data
- reading time bucket data
- reading KPI data
- reading row data
- reading meta / governance data
- assembling them into the same payload contract the UI already expects

Do not return raw database rows directly to the UI.

---

### 3. Preserve the Existing Payload Contract Exactly

The UI must continue to receive the same top-level payload domains:

- `reportContext`
- `timeBuckets`
- `kpi`
- `rows`
- `meta`

Do not rename fields.
Do not weaken the contract.
Do not require UI components to understand database tables.

The Supabase-backed path must flow through the transformation layer and return the same `ReportView` contract already established.

---

### 4. Keep the Local Adapter as Fallback

Do not remove the current `LocalAdapter`.

Instead:
- preserve it as a fallback path
- make the active adapter swappable in one place
- allow the prototype to continue working even if Supabase data is incomplete during the transition

The UI should still have one clean repository entry point.

---

### 5. Store and Read Prototype Data in Supabase

Persist the prototype-supporting data needed for the current report experience.

At minimum, the Supabase-backed path must support:
- report context
- governed time buckets
- KPI payload values and reconciliation
- row entities
- row summary values
- row time bucket values
- exclusion metadata
- census context
- decomposition metadata
- aggregation metadata
- drill metadata
- lineage metadata
- trust / governance metadata
- transaction traceability where already represented

If the environment supports only the standard Figma Make Supabase backend primitives, use those appropriately.
Do not invent a second backend system.

---

### 6. Seed Supabase with Realistic Prototype Data

Populate the connected Supabase project with enough realistic prototype data to support the existing flows, including:
- Facility pivot
- GL drill
- governed bucketed views
- Full Timeframe views
- exclusion cases
- Actual / Commitment / Total Impact modes
- transaction-linked spend behavior
- mixed census context where applicable

Seed data must support the existing UI flows without requiring visual or behavioral changes.

---

### 7. Preserve Calculation Behavior

Do not change calculation logic in this pass.

If current values are derived through the existing shaping logic and transformation path, preserve that behavior.

This pass is for:
- data source connection
- adapter implementation
- data retrieval
- payload preservation

It is not for changing formulas or reinterpretation of business rules.

---

### 8. Preserve Existing UI Behavior

Do not change:
- control bar behavior
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

Only replace the backing data source path behind the existing architecture.

---

### 9. Preserve Trust and Governance Metadata

Ensure the Supabase-backed path continues to preserve and return:
- `calculationEngineVersion`
- `kernelVersion`
- governance flags
- spend rules
- time rules
- exclusion metadata
- decomposition metadata
- lineage metadata

Even if some of these are not yet fully surfaced in the UI, they must remain present in the payload.

---

### 10. Confirm the Active Data Flow

After implementation, the active data flow should be structurally:

Supabase
→ database-facing records
→ transformation layer
→ `ReportView`
→ repository / adapter
→ `App.tsx`
→ `EnterpriseGrid`

Do not leave conflicting direct stub reads in place for the active path.

## Preserve

- Existing visual design
- Existing interaction model
- Existing payload contract
- Existing calculation behavior
- Existing drill model
- Existing sort and filter behavior
- Existing sticky and overflow behavior
- Existing LocalAdapter fallback

## Output

Respond with exactly these sections:

1. Supabase connection status
2. Supabase adapter added
3. Files touched
4. Current active data flow
5. Fallback path preserved
6. Payload contract preserved
7. Confirmation that no calculation logic changed
8. Confirmation that no layout, structure, or behavior changed

Do not propose next steps.
Stop after reporting changes.