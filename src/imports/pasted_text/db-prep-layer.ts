# Prompt 33C - Complete the Database Preparation Layer Without Connecting Supabase Yet

You are still in STRICT EXECUTION MODE.

## Constraints

Do not make assumptions.  
Do not redesign anything.  
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.  
Do not change the existing UI payload contract.  
Do not require a live Supabase connection in this pass.  
Do not introduce Vercel-specific assumptions.  
Do not leave business logic duplicated across the UI and data layers.

This is a structural code architecture pass only.

## Objective

Complete the missing preparation work required so this prototype can later connect to Supabase **without structural rework**.

The current codebase already has payload-facing types and stubbed ReportView objects, but it is still missing:

- database-facing types
- a typed transformation layer
- a repository / adapter abstraction
- a local adapter implementation
- relocation of data shaping logic out of `App.tsx`

This pass must add those missing artifacts while preserving existing UI behavior.

## Required Outcomes

After this pass, the prototype must have:

1. explicit database-facing types
2. explicit payload-facing types
3. a typed transformation layer from database-shaped records to payload-shaped `ReportView`
4. a repository / adapter boundary between UI and data source
5. a local adapter implementation using database-shaped seed data
6. removal of view-specific data fabrication from `App.tsx`
7. no change to visual UI behavior

## Changes to Implement

### 1. Add Database-Facing Types

Create explicit database-oriented TypeScript types/interfaces in a separate file or files.

These must represent database-shaped records, not UI payloads.

They should cover, at minimum:

- report contexts
- time bucket records
- KPI records
- KPI reconciliation records
- entity rows
- row summary records
- row time bucket records
- exclusion records
- census context records
- decomposition records
- aggregation records
- drill records
- lineage records
- report meta records
- transaction reference records where applicable

Name them clearly as database-facing types.

Examples of acceptable naming patterns:
- `DbReportContext`
- `DbTimeBucket`
- `DbRow`
- `DbRowTimeBucket`
- `DbKpi`
- `DbMeta`

Do not replace payload-facing types with these.  
Keep the layers separate.

---

### 2. Preserve Payload-Facing Types

Keep the existing payload-facing contract intact.

The UI must still consume a `ReportView` shape with:

- `reportContext`
- `timeBuckets`
- `kpi`
- `rows`
- `meta`

Do not rename these fields.  
Do not weaken the existing payload contract.

---

### 3. Add a Typed Transformation Layer

Create explicit transformation functions that map database-shaped records into payload-shaped objects.

This transformation layer must be typed and traceable.

It should include, at minimum:

- database context -> `ReportContext`
- database time buckets -> `TimeBucketDefinition[]`
- database KPI records -> `ReportKpi`
- database rows and related records -> `ReportRow[]`
- database meta -> `ReportMeta`
- final assembly into `ReportView`

Do not construct payload-shaped objects ad hoc in multiple places.

The transformation layer should be the single path from database shape to UI payload shape.

---

### 4. Add a Repository / Adapter Boundary

Create a repository / adapter abstraction between the UI and the underlying data source.

Examples of acceptable responsibilities:
- `getReportView(viewId)`
- `getRootView()`
- `getDrillView(viewId)`
- `listAvailableViews()` if needed

The UI must stop reading directly from an in-memory `Map<string, ReportView>`.

Instead, the UI should call the repository / adapter, and the repository should return payload-shaped `ReportView` data.

---

### 5. Add a Local Adapter Implementation

Because Supabase is not being connected yet, create a local implementation of the repository / adapter that reads from **database-shaped seed data**, not directly from payload-shaped view blobs.

This local adapter should:

- use the new database-facing types
- transform those records into payloads through the transformation layer
- return the exact `ReportView` contract the UI already expects

This local adapter becomes the temporary source of truth until Supabase is connected.

---

### 6. Move UI-Level Data Fabrication Out of `App.tsx`

Remove data fabrication and shaping logic from `App.tsx` that should belong in the data path.

Specifically address the issues identified in the audit:

- move `mapRowForTable()` responsibilities out of `App.tsx`
- remove fabricated census display generation from `App.tsx`
- move period label generation out of hardcoded UI helpers where it conflicts with governed `timeBuckets`
- move timeframe scaling / multipliers out of UI-only constants if they are part of data shaping
- move spend mode and period expansion shaping out of UI where appropriate for the prepared data path

Important:
- do not change user-visible behavior
- do not change calculation logic
- do not redesign the screen

The goal is to relocate data shaping to the repository / transformation layer so the UI becomes a consumer, not a constructor.

---

### 7. Keep the Existing UI Contract Stable

After refactoring, `App.tsx` should consume the same payload contract as before, but through the repository / adapter boundary.

The UI should not need to know whether the source is:
- local seed data
- future Supabase-backed data

That swap should be isolated behind the data layer.

---

### 8. Keep Seed Data Realistic and Database-Shaped

Refactor the existing stubs so they exist in a shape closer to future relational data, not only as final UI payloads.

The local seeded data should still support:
- Facility pivot
- GL drill
- governed time buckets
- Full Timeframe and bucketed views
- exclusion cases
- Actual / Commitment / Total Impact modes
- transaction-linked spend behavior
- mixed census context where applicable

Do not fall back to a single hardcoded `ReportView` map as the primary model.

---

### 9. Preserve Existing Behavior

Do not change:

- control bar behavior
- breadcrumb behavior
- KPI layout
- table layout
- sticky behavior
- scroll behavior
- filtering or sorting behavior
- drill behavior
- overlay behavior
- spend mode behavior
- timeframe behavior
- Breakdown By behavior

This is an architecture pass, not a redesign pass.

## Preserve

- Existing visual design
- Existing interaction model
- Existing payload contract
- Existing calculation behavior
- Existing drill model
- Existing sort and filter behavior
- Existing sticky and overflow behavior

## Output

Respond with exactly these sections:

1. Database-facing types added  
2. Payload-facing types preserved  
3. Transformation functions added  
4. Repository / adapter boundary added  
5. Local adapter implementation added  
6. Logic removed from `App.tsx` and relocated  
7. Current data flow after refactor  
8. Confirmation that the UI still consumes the same `ReportView` contract  
9. Confirmation that no calculation logic changed  
10. Confirmation that no layout, structure, or behavior changed  

Do not propose next steps.  
Stop after reporting changes.