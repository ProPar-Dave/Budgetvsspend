# Budget vs Spend — Complete UI/UX Execution Requirements

**Document version:** 1.2
**System date:** March 29, 2026
**Seed version:** v8-excluded-spend-separation
**Stack:** React 18, TypeScript, Tailwind CSS v4, @tanstack/react-table, @tanstack/react-virtual
**Data adapters:** LocalAdapter (in-memory seed), SupabaseAdapter (KV-backed server API)

---

# 1. REPORT CONTEXT MODEL

The report context determines what data is shown and how it is shaped. Five independent dimensions govern the view.

## 1.1 pivotBy

- **Allowed values:** `facility`, `glAccount`, `vendor`
- **Default:** `facility`
- **Effect on KPI:** Changes the root view and therefore the authoritative KPI aggregate. Each pivot root has its own independent dbAggregates entry.
- **Effect on rows:** Changes the entity type of root-level rows (Facilities, GL Accounts, or Vendors).
- **Effect on drill:** Determines the drill path. See Section 5.
- **Root view IDs:**
  - `facility` → `fac-root`
  - `glAccount` → `gl-root`
  - `vendor` → `vendor-root`
- **On change:** MUST reset `activeViewId` to the corresponding root view ID. MUST NOT preserve drill state from a different pivot.

## 1.2 timeframe

- **Allowed values:** `last7Days`, `last30Days`, `monthToDate`, `lastMonth`, `quarterToDate`, `lastQuarter`, `yearToDate`, `last12Months`, `customRange`
- **Default:** `monthToDate`
- **Effect on KPI:** KPI values are multiplied by `TIMEFRAME_MULTIPLIER[timeframe]`.
- **Effect on rows:** Row budget/consumed/variance values are multiplied by the same multiplier.
- **Multipliers:**
  - `last7Days`: 0.25
  - `last30Days`: 1.0
  - `monthToDate`: 1.0
  - `lastMonth`: 1.25
  - `quarterToDate`: 3.0
  - `lastQuarter`: 3.0
  - `yearToDate`: 12.0
  - `last12Months`: 12.0
  - `customRange`: 1.0
- **On change:** MUST reset `viewBy` to `fullTimeframe`. The UI enforces valid viewBy combinations per timeframe (Section 6).
- **Custom Range:** Selecting `customRange` MUST open the `DateRangePickerPopover`. If the user dismisses without completing, MUST revert to the previous timeframe.

## 1.3 viewBy (Breakdown By)

- **Allowed values:** `daily`, `weekly`, `monthly`, `quarterly`, `fullTimeframe`
- **Default:** `fullTimeframe` (reset on every timeframe change)
- **Validity constraints per timeframe:**
  - `last7Days`: `daily`, `fullTimeframe`
  - `last30Days`: `daily`, `weekly`, `fullTimeframe`
  - `monthToDate`: `daily`, `weekly`, `fullTimeframe`
  - `lastMonth`: `daily`, `weekly`, `fullTimeframe`
  - `quarterToDate`: `weekly`, `monthly`, `fullTimeframe`
  - `lastQuarter`: `weekly`, `monthly`, `fullTimeframe`
  - `yearToDate`: `monthly`, `quarterly`, `fullTimeframe`
  - `last12Months`: `monthly`, `quarterly`, `fullTimeframe`
  - `customRange`: `daily`, `weekly`, `fullTimeframe`
- **Effect on KPI:** None. KPI is NOT affected by viewBy.
- **Effect on rows:** When `viewBy !== "fullTimeframe"`, each base row is expanded into N period-stacked rows (one per generated period label). Each expanded row receives a `period` field and fractional budget/consumed/variance values derived from a deterministic seed-based weight function.
- **On change to `fullTimeframe`:** MUST clear any active column filter on the `period` column.

## 1.4 metric

- **Allowed values:** `dollars`, `ppd`
- **Default:** `ppd` (as set in App.tsx initial state)
- **Effect on KPI:** When `ppd`, all KPI numeric values are divided by 100 after timeframe multiplication.
- **Effect on rows:** Same division by 100 applied to budget/consumed/variance.
- **Effect on columns:** When `ppd`, the `Census` column is appended to the table. Column headers receive a ` (PPD)` suffix on Budget, Spend, Variance. KPI labels receive the same suffix.
- **Effect on formatting:**
  - `dollars`: KPI uses `formatKpiCurrency` ($X,XXX.XX with sign handling). Table uses `formatNumber` ($X,XXX with 2 decimal places).
  - `ppd`: KPI uses `formatKpiPpd` (same $X,XXX.XX format). Table uses `formatNumber` (same format).

## 1.5 spendMode

- **Allowed values:** `actual`, `commitment`, `totalImpact`
- **Default:** `totalImpact` (as set in App.tsx initial state)
- **Effect on KPI:** KPI consumed/variance are recalculated after spend mode transformation.
- **Effect on rows:**
  - `actual`: No transformation. Consumed = base spend.
  - `commitment`: Consumed = base consumed * 1.1. Variance = budget - consumed (recalculated).
  - `totalImpact`: Consumed = base consumed + committed. Variance = budget - consumed (recalculated).
- **Spend mode is applied BEFORE timeframe and metric transformations in the pipeline.**

---

# 2. KPI CONTRACT (NON-NEGOTIABLE)

## 2.1 KPI Fields

| Field | Type | Description |
|-------|------|-------------|
| `budget` | number | Total budget for the current view scope |
| `consumed` | number | Total budget-relevant spend (excludes excluded rows) |
| `variance` | number | ALWAYS `budget - consumed` (derived, never stored) |
| `percent` | number | `Math.round((variance / budget) * 100)`, or `0` if budget is 0 |
| `excludedSpend` | number | Sum of spend from excluded rows. Separate. Does NOT affect consumed, variance, or percent. |
| `reconciliation` | object | `{ rowCount, includedRows, excludedRows, checksum }` |

## 2.2 Invariant Rules

- `variance` MUST ALWAYS equal `budget - consumed`. No exceptions. No stored overrides.
- `consumed` MUST NEVER include spend from excluded rows.
- `excludedSpend` MUST NEVER affect `consumed`, `variance`, or `percent`.
- `percent` MUST be 0 when `budget` is 0.

## 2.3 KPI Source

- KPI values are sourced from `DbView.kpi`, which is populated by `computeAuthoritativeKpi`.
- `computeAuthoritativeKpi` performs a pure lookup into `dbAggregates` — an independent aggregate source layer. It does NOT read from `dbRows[]`.
- `dbAggregates` is a `Record<string, { budget, consumed, excludedSpend }>` with entries for every view.
- For transaction-level views, aggregates are INHERITED from the parent row's seed primitives (the vendor/facility row that was drilled into), NOT summed from transaction rows.

## 2.4 Drift Guard

- `computeKpiFromRows` exists as a development-time drift detection function.
- On every `assembleReportView` call, it compares row-derived KPI against authoritative KPI.
- A tolerance of $1 is allowed for rounding.
- Drift is logged via `console.warn` with `[KPI_DRIFT]` prefix. It does NOT block rendering.
- `computeKpiFromRows` MUST NEVER be used as the source of KPI values in production.

## 2.5 KPI Display Transformations

When displayed in the UI, raw KPI values from the view are transformed:

1. **Timeframe multiplication:** `value * TIMEFRAME_MULTIPLIER[timeframe]`
2. **Metric division:** If `metric === "ppd"`, divide by 100.
3. **Percent recalculation:** `percent` is recalculated after multiplication: `Math.round((variance / budget) * 100)`, or 0 if budget is 0.

These transformations occur in `repository.getProcessedData`.

## 2.6 KPI Display in UI

- Four primary KPI cards rendered in a horizontal bar:
  - Total Budget / Total Budget (PPD)
  - Total Consumed / Total Consumed (PPD)
  - Total Variance / Total Variance (PPD)
  - Variance %
- Variance and Variance % use red text (`text-red-600`) when negative (overage).
- Font: 1.05rem, weight 600 (650 for overage).

## 2.7 excludedSpend Display

- Rendered as a secondary line beneath the "Total Consumed" KPI card.
- **Condition:** Only rendered when `kpi.excludedSpend > 0`.
- **Label:** "Excluded"
- **Format:** Same currency/PPD format as other KPI values, respecting current metric mode.
- **Styling:** `text-[10px] text-gray-400 mt-0.5 cursor-default`
- **Tooltip:** Native `title` attribute: "Spend not counted toward budget or variance"
- **Interactions:** NONE. No filters, no toggles, no drill behavior.
- **Math impact:** NONE. excludedSpend MUST NOT affect consumed, variance, percent, or sorting.

---

# 3. DATA BINDING CONTRACT

## 3.1 ReportView Payload Structure

```typescript
type ReportView = {
  id: string
  breadcrumbPath: BreadcrumbSegment[]
  scopeLabel: string
  reportContext: ReportContext
  timeBuckets: TimeBucketDefinition[]
  kpi: ReportKpi
  rows: ReportRow[]
  entityTypeLabel: string
  meta: ReportMeta
}
```

## 3.2 UI Binding Points

| UI Element | Data Source | Authoritative? |
|------------|-------------|----------------|
| KPI bar | `ReportView.kpi` → transformed by repository | YES |
| Table rows | `ReportView.rows` → mapped to `TableRow[]` → data-shaped | NO (display only) |
| Breadcrumb | `ReportView.breadcrumbPath` | YES |
| Scope label | `ReportView.scopeLabel` | YES |
| Column header (first col) | `ReportView.entityTypeLabel` | YES |
| Time context label | Derived from `timeframe` + `viewBy` + custom dates | Computed |

## 3.3 Row Fields

### Required Fields

| Field | Type | Null Handling |
|-------|------|---------------|
| `id` | string | Never null |
| `entityType` | `"Facility" \| "GL Account" \| "Vendor" \| "Transaction"` | Never null |
| `label` | string | Never null |
| `spend` | number | Always 0 if no data |
| `committed` | number | Always 0 if no data |
| `excluded` | boolean | Always false if not excluded |
| `childViewId` | `string \| null` | null = terminal row (no drill) |

### Nullable Fields

| Field | Type | Null Semantics |
|-------|------|----------------|
| `budget` | `number \| null` | null for excluded rows (displayed as "Excluded") |
| `variance` | `number \| null` | null for excluded rows (displayed as "--") |
| `variancePercent` | `number \| null` | null when excluded OR budget is 0 |
| `po` | `string \| null` | null if no PO |
| `invoice` | `string \| null` | null if no invoice |
| `txnType` | `"PO" \| "INVOICE" \| "PO_AND_INVOICE" \| "MANUAL_ACCRUAL" \| null` | null for non-transaction rows |

### Excluded Row Handling

- When `excluded === true`:
  - `budget` is set to 0 in transform
  - `variance` is set to null
  - `variancePercent` is null
  - `status` is "Excluded"
  - Spend and committed retain their real values
  - Row is still visible in the table

## 3.4 Rows Are NOT Source of Truth

- Rows are for display only.
- KPI is authoritative.
- Rows MUST reconcile to KPI (checked by drift guard).
- No business logic derives KPI from rows.

---

# 4. TABLE BEHAVIOR

## 4.1 Column Structure

### Non-Transaction Views

| Column ID | Header | Size | Min | Pinned | Numeric | Filterable | Sortable | Group |
|-----------|--------|------|-----|--------|---------|------------|----------|-------|
| `name` | [entityTypeLabel] | 220 | 140 | left | No | No | No | - |
| `period` | Period | 140 | 100 | No | No | Yes | Yes | - |
| `budget` | Budget / Budget (PPD) | 110 | 80 | No | Yes | No | Yes | groupStart |
| `consumed` | Spend / Spend (PPD) | 130 | 80 | No | Yes | No | Yes | - |
| `variance` | Variance / Variance (PPD) | 160 | 110 | No | Yes | No | Yes | - |
| `variancePercent` | % | 80 | 60 | No | Yes | No | Yes | groupEnd |
| `census` | Census | 140 | 90 | No | No | No | Yes | - |
| `status` | Status | 150 | 120 | No | No | Yes | Yes | - |

- `period` column is only included when `viewBy !== "fullTimeframe"` (i.e., `showPeriod === true`).
- `census` column is only included when `metric === "ppd"`.

### Transaction Views

- `name` column is replaced by `transactions` column (ID: `transactions`, pinned left).
- Column pinning automatically switches: `columnPinning.left` is set to `["transactions"]`.
- All other columns remain the same.

## 4.2 Column Pinning

- First column (`name` or `transactions`) is pinned left.
- Pinned columns have sticky positioning with `z-index: 5` for body cells, `z-index: 30` for headers.
- A right-side box shadow (4px) is applied to the last left-pinned column.

## 4.3 Column Resizing

- Enabled globally via `enableColumnResizing: true`.
- Resize mode: `onChange`.
- Default min: 120px, max: 600px (overridden per column with explicit `minSize`).
- Resize handle: 4px wide, 12px tall, positioned at top-right of header cell.
- Handle color: `#AEB3BC` default, `#005390` when actively resizing.

## 4.4 Scroll Behavior

- The entire grid is contained in a single scrollable `div` with `overflow: auto`.
- The breadcrumb/scope bar is `sticky top-0` with `z-index: 50`.
- Table headers are `sticky` positioned at `top: stickyHeaderHeight` (dynamically measured via ResizeObserver).
- Report controls and KPI bar are `sticky left-0` (horizontal scroll only).
- Virtualization: Rows are virtualized using `@tanstack/react-virtual` with `estimateSize: 40px` and `overscan: 15`.

## 4.5 Sorting

- Managed via `@tanstack/react-table` `getSortedRowModel`.
- All numeric columns and status column are sortable.
- `name`/`transactions` column: sortable on transaction views only.
- Sort indicator: `↑` (asc), `↓` (desc), `⇅` (unsorted, gray).
- Click on header label toggles sort direction.
- `variancePercent` uses a custom `sortingFn`: sorts null values as 0.
- `status` uses a custom `sortingFn`: Over Budget (0) < Healthy (1) < Excluded (2).
- `census` uses a custom `sortingFn`: sorts by sum of census values.
- State persists in `GridState.sorting`. Stale column IDs are filtered out on each render.

## 4.6 Filtering

- Managed via `@tanstack/react-table` `getFilteredRowModel`.
- Filter inputs are rendered inline below column headers.
- Filterable columns: `transactions`, `period`, `status`.
- Filter function: case-insensitive substring match.
- Clear button: 10px "X" circle (`#005390` background, white text) appears when filter has value.
- Stale column filter IDs are filtered out on each render.

## 4.7 Cell Rendering

### Name Column
- Font weight: 550, color: `#1e293b`.

### Numeric Columns
- Right-aligned.
- Over-budget rows: `text-gray-800`.
- Healthy rows: `text-gray-500`.
- Budget column: displays "Excluded" when value is 0.
- Variance column: displays "--" when budget is 0.
- Variance % column: displays "--" when value is null.

### Status Column
- "Excluded": `text-gray-400`
- "Over Budget": `text-red-700`, font weight 600
- "Healthy": `text-green-600/80`

### Transactions Column
- PO + Invoice display: `{PO} . {Invoice}` with separator in `text-gray-300`.
- Clickable links: blue underlined (`color: #005390`, `underline`, `cursor-pointer`).
- "No PO" / "No Invoice": `text-gray-400`, not clickable.
- Manual Accrual: single clickable label (accrual name).
- Click: `e.stopPropagation()` prevents drill. Opens overlay modal.

### Census Column (PPD only)
- Single census: plain number with tooltip showing type.
- Multiple census: parenthesized values, each with tooltip.
- No data: "--".

## 4.8 Row States

| State | Condition | Visual |
|-------|-----------|--------|
| Normal / Healthy | `budget > 0 && variance >= 0` | Default white background |
| Over Budget | `budget > 0 && variance < 0` | `bg-red-50/50` background |
| Excluded | `budget === 0` | No special background, "Excluded" in budget cell, "--" in variance |
| Drillable | `childViewId !== null` | `cursor-pointer`, `hover:bg-blue-50/60` |
| Terminal | `childViewId === null` | `select-none`, no hover effect |

## 4.9 Density System

- Three modes: `comfortable`, `standard`, `compact`.
- Default: `compact`.
- Controls vertical padding on body cells:
  - `comfortable`: `py-3`
  - `standard`: `py-2`
  - `compact`: `py-1`
- Controls filter input height:
  - `comfortable`: 28px
  - `standard`: 24px
  - `compact`: 20px

## 4.10 Visual Lens Indicator

- When any report control is non-default (`facilityScope !== "all" || timeframe !== "monthToDate" || metric !== "dollars" || spendMode !== "actual"`):
  - Header background changes from `#f4f5f7` to `#f0f5fa` (blue tint).
- This provides a visual cue that the user is viewing filtered/transformed data.

---

# 5. DRILL-DOWN SYSTEM

## 5.1 Drill Paths

### Facility Pivot
```
Facility → GL Account → Vendor → Transaction
fac-root → fac-{facility}-gl → fac-{fac}-gl{code}-vendor → {vendor}-txn
```

### GL Account Pivot
```
GL Account → Vendor → Transaction
gl-root → gl-{code}-vendor → gl-{code}-{vendor}-txn
```

### Vendor Pivot
```
Vendor → Facility → Transaction
vendor-root → vendor-{vendor}-fac → vendor-{vendor}-{facility}-txn
```

## 5.2 Drill Trigger

- Row click on any row where `childViewId !== null`.
- `e.stopPropagation()` on transaction link clicks prevents drill when clicking links.
- On drill: `onActiveViewIdChange(childViewId)` is called.
- An audit event `DRILL_DOWN` is emitted with the row name and childViewId.

## 5.3 Drill State

- Stored as a single `activeViewId: string`.
- No stack or history. Navigation is via breadcrumb or row click.
- Changing pivot resets to root.

## 5.4 What Changes on Drill

| Element | Changes? | Details |
|---------|----------|---------|
| KPI | YES | New authoritative KPI from the target view's dbAggregates entry |
| Rows | YES | New rows from the target view |
| Breadcrumb | YES | Longer path, parent segments become clickable |
| Scope label | YES | e.g., "GL Accounts within North Ridge" |
| Entity type label | YES | Changes first column header (e.g., "Facilities" → "GL Accounts") |
| Report controls | NO | Timeframe, metric, spendMode, viewBy remain unchanged |
| Column pinning | MAYBE | Switches between `name` and `transactions` for transaction views |
| Sort/filter state | NO | Persists across drill (stale IDs filtered out) |

## 5.5 Breadcrumb Construction

- Each view has ordered `DbBreadcrumbSegment` records (position 0, 1, 2, ...).
- Segments where `targetViewId !== null` are clickable (blue, underlined on hover).
- The last segment (current level) has `targetViewId: null` (non-clickable, bold).
- Clicking a breadcrumb segment: calls `onActiveViewIdChange(seg.viewId)`.

## 5.6 Transaction View Generation

- Every Vendor and Facility row that lacks a `childViewId` gets a programmatically generated transaction view.
- Each generated view contains 3-4 transaction rows whose budget/spend/committed/variance sum exactly to the parent row's values.
- Transaction types: Invoice-only, Invoice-only, PO+Invoice, Manual Accrual.
- If the parent is excluded, all generated transaction rows inherit `excluded: true` with exclusion records.

---

# 6. TIME MODEL

## 6.1 Timeframe Selection

- Rendered as a native `<select>` dropdown with the `DateRangePickerPopover` wrapping it.
- Predefined ranges are based on a fixed "today" of March 20, 2026.
- Custom Range opens a date picker popover. Dismissal without selection reverts to previous timeframe.

## 6.2 Period Generation

- When `viewBy !== "fullTimeframe"`, periods are generated by `generatePeriodLabels(timeframe, viewBy)`.
- Period labels are formatted strings:
  - `daily`: "Mar 14, 2026"
  - `weekly`: "Mar 8, 2026" (Monday of each week)
  - `monthly`: "Mar 2026"
  - `quarterly`: "Q1 2026"
  - `fullTimeframe`: "Mar 2026 - Mar 2026" (single period, no expansion)

## 6.3 Row Expansion (Period Stacking)

- Each base row is expanded into N rows (one per period).
- Each expanded row receives:
  - `period`: the period label string
  - Budget/consumed/variance: weighted fractions of the base values
- Weight function: `fraction + (seed - 0.05) * fraction` where `seed = ((rowIdx * 7 + pIdx * 13) % 10) / 100` and `fraction = 1 / periodCount`.
- Values are `Math.round()`-ed. This means expanded row sums may differ slightly from the base due to rounding.

## 6.4 Time Context Label

- Displayed below the breadcrumb: `"{scopeLabel} | {timeContextLabel}"`.
- Generated by `getTimeContextLabel(timeframe, viewBy, customStart, customEnd)`.
- Format varies by viewBy:
  - `daily`/`fullTimeframe`: "Mar 1, 2026 - Mar 20, 2026"
  - `weekly`: "Weeks of Mar 1, 2026 - Mar 20, 2026"
  - `monthly`: "Mar 2026 - Mar 2026"
  - `quarterly`: "Q1 2026 - Q1 2026"

## 6.5 Daily Grain Truth

- The underlying data model assumes daily grain is truth.
- All period views are derived aggregations over daily data.
- In the current seed prototype, this is simulated via the weight function.

## 6.6 Period Expansion Reconciliation Exception

When `viewBy !== "fullTimeframe"`:

- Period-expanded rows are **display-only** representations of the base row's values distributed across time periods.
- Due to rounding from fractional allocation (`Math.round()` on weighted values), period rows are **NOT required to reconcile exactly** to base row totals.
- The sum of period-expanded budget/consumed/variance values MAY differ from the base row's values by a small rounding error.

**Reconciliation rules apply ONLY to:**
- Base (non-expanded) rows vs their children
- KPI vs base (non-expanded) rows

**Agents MUST NOT attempt to:**
- Rebalance period rows to force exact sums
- Inject correction/remainder values into the last period
- Adjust rounding logic to force equality
- Treat period-expanded row sums as a reconciliation failure

---

# 7. METRIC SWITCH (DOLLARS vs PPD)

## 7.1 Transformation Pipeline Position

Metric transformation is applied AFTER spend mode and timeframe transformations:
```
Base rows → Spend Mode → Timeframe Multiplier → Metric Division → Period Expansion
```

## 7.2 KPI Value Changes

- `dollars`: Values are displayed as-is (after timeframe multiplication).
- `ppd`: All numeric KPI values are divided by 100.

## 7.3 Table Value Changes

- Same division by 100 applied to row budget/consumed/variance.
- Committed values are NOT explicitly transformed (they flow through spend mode first).

## 7.4 Formatting Differences

| Context | Dollars | PPD |
|---------|---------|-----|
| KPI values | `$X,XXX.XX` | `$X,XXX.XX` |
| Table values | `X,XXX.XX` (no $ prefix) | `X,XXX.XX` (no $ prefix) |
| Column headers | `Budget`, `Spend`, `Variance` | `Budget (PPD)`, `Spend (PPD)`, `Variance (PPD)` |
| KPI labels | `Total Budget`, etc. | `Total Budget (PPD)`, etc. |

## 7.5 Additional Column

- When `metric === "ppd"`, the Census column is added after Variance %.
- Census data comes from `DbCensusDisplay` records mapped by row ID.

## 7.6 PPD Is Post-Aggregation

- PPD is a display transformation only.
- No recalculation occurs at the row level.
- Division by 100 is applied uniformly.

---

# 8. SPEND MODE BEHAVIOR

## 8.1 Actual

- Consumed = base spend value (no transformation).
- Variance = budget - consumed.
- This is the raw data as recorded.

## 8.2 Commitment

- Consumed = base consumed * 1.1 (10% markup to simulate commitment pipeline).
- Variance = budget - adjusted consumed.
- This represents anticipated spend including open commitments.

## 8.3 Total Impact

- Consumed = base consumed + committed.
- Variance = budget - total impact consumed.
- This shows the full financial exposure: actuals plus open commitments.

## 8.4 Pipeline Position

Spend mode is the FIRST transformation in the data shaping pipeline:
```
Base rows → Spend Mode → Timeframe → Metric → Period Expansion
```

## 8.5 KPI Alignment

- KPI consumed/variance are recalculated in `getProcessedData` using the same spend mode, timeframe, and metric transforms applied to rows.
- Spend mode MUST be applied to KPI using the same transformation rules as rows.
- Updated KPI pipeline:
  ```
  Base KPI → Spend Mode → Timeframe Multiplier → Metric Division
  ```
- This ensures:
  - `SUM(rows.consumed) == KPI.consumed` (at base level, before period expansion)
  - `SUM(rows.budget) == KPI.budget`
  - `variance == budget - consumed` holds across all views
- There are NO scenarios where KPI and rows are allowed to diverge due to spend mode.
- At `actual` mode + `monthToDate` timeframe + `dollars` metric, KPI matches the raw dbAggregates values exactly.

### KPI Spend Mode Rules (mirroring row-level rules)

| Mode | KPI consumed | KPI variance |
|------|-------------|-------------|
| `actual` | `base consumed` (no change) | `budget - consumed` |
| `commitment` | `base consumed * 1.1` | `budget - adjusted consumed` |
| `totalImpact` | `base consumed * 1.1` | `budget - adjusted consumed` |

---

# 9. EXCLUDED LOGIC

## 9.1 Row-Level Exclusion

### Properties of Excluded Rows
- `excluded: true`
- `budget`: Set to 0 in `transformRow` (regardless of original value)
- `variance`: Set to null
- `variancePercent`: null
- `status`: "Excluded"
- `spend`: Retains real value
- `committed`: Retains real value
- `childViewId`: May still be non-null (drill is still available)

### Row Transform Logic (in `transformRow`)
```typescript
const budget = excluded ? 0 : (db.budget ?? 0)
const variance = excluded ? null : db.variance
const status = excluded ? "Excluded" : ...
```

### Row Table Mapping (in `mapRowForTable`)
```typescript
variance: r.variance ?? (r.excluded ? -(r.spend) : 0)
```
When excluded, variance defaults to negative spend (for sorting purposes only).

## 9.2 KPI-Level Exclusion

- `excludedSpend` is aggregated separately in `dbAggregates`.
- It represents the total spend from excluded rows within a view scope.
- `excludedSpend` does NOT affect:
  - `consumed` (which counts only non-excluded spend)
  - `variance` (which is `budget - consumed`)
  - `percent` (which derives from variance/budget)

## 9.3 Exclusion Propagation

- Excluded GL accounts propagate exclusion to all child vendor rows and their transaction rows.
- Example: GL 5400 (Purchased Services) under North Ridge is excluded → all vendors under it are excluded → all transactions under those vendors are excluded.
- Exclusion records carry `propagated: true` and reference the source ("Budget Kernel", "Parent GL excluded").

## 9.4 Excluded Row Styling

- Budget column: displays text "Excluded" (not a number).
- Variance column: displays "--".
- Variance % column: displays "--".
- Status column: `text-gray-400`, displays "Excluded".
- No background color change (excluded rows do NOT get red background).
- Excluded rows ARE still drillable if they have a `childViewId`.

## 9.5 Excluded Row in Drill

- Drilling into an excluded row shows a view where:
  - All child rows are also excluded.
  - KPI reflects: budget=0, consumed=0, variance=0, excludedSpend= parent's spend.
  - The arithmetic identity holds: `budget(0) - consumed(0) = variance(0)`.

---

# 10. STATE MANAGEMENT

## 10.1 State Variables

| State | Location | Type | Default |
|-------|----------|------|---------|
| `gridState` | App.tsx | `GridState` | `{ sorting: [], columnVisibility: {}, columnPinning: { left: ["name"] }, columnSizing: {}, columnSizingInfo: {}, columnFilters: [] }` |
| `viewState` | App.tsx | `"default" \| "loading" \| "empty" \| "error"` | `"default"` |
| `metric` | App.tsx | `"dollars" \| "ppd"` | `"ppd"` |
| `spendMode` | App.tsx | `"actual" \| "commitment" \| "totalImpact"` | `"totalImpact"` |
| `timeframe` | App.tsx | `Timeframe` | `"monthToDate"` |
| `viewBy` | App.tsx | `ViewBy` | `"fullTimeframe"` |
| `facilityScope` | App.tsx | `"all" \| string` | `"all"` |
| `pivotBy` | App.tsx | `"facility" \| "glAccount" \| "vendor"` | `"facility"` |
| `activeViewId` | App.tsx | `string` | `"fac-root"` |
| `dataSource` | App.tsx | `"local" \| "supabase"` | `"local"` |
| `density` | EnterpriseGrid | `"comfortable" \| "standard" \| "compact"` | `"compact"` |
| `overlayTransaction` | App.tsx | `string \| null` | `null` |
| `showDatePicker` | EnterpriseGrid | `boolean` | `false` |
| `customStart` | EnterpriseGrid | `Date \| null` | `new Date(2026, 1, 1)` |
| `customEnd` | EnterpriseGrid | `Date \| null` | `new Date(2026, 2, 20)` |

## 10.2 GridState Shape

```typescript
type GridState = {
  sorting: any[]
  columnVisibility: Record<string, boolean>
  columnPinning: { left?: string[]; right?: string[] }
  columnSizing: Record<string, number>
  columnSizingInfo: any
  columnFilters: any[]
}
```

## 10.3 State Change Propagation

- All report control changes trigger `useMemo` recomputation of `processedData`.
- `processedData` dependencies: `[activeViewId, spendMode, timeframe, metric, viewBy, facilityScope, pivotBy, dataSource]`.
- Column pinning is automatically adjusted when switching between transaction and non-transaction views.
- GridState changes are propagated via `onGridStateChange` callback to `useReactTable`.

## 10.4 Cross-State Dependencies

| Trigger | Side Effects |
|---------|-------------|
| `pivotBy` change | Resets `activeViewId` to pivot root |
| `timeframe` change | Resets `viewBy` to `"fullTimeframe"` |
| `viewBy` set to `"fullTimeframe"` | Clears `period` column filter |
| View has `entityTypeLabel === "Transactions"` | Switches `columnPinning.left` to `["transactions"]` |
| View has `entityTypeLabel !== "Transactions"` | Switches `columnPinning.left` to `["name"]` |

---

# 11. PERFORMANCE BEHAVIOR

## 11.1 Virtualization

- Row virtualization via `@tanstack/react-virtual` `useVirtualizer`.
- Estimated row size: 40px.
- Overscan: 15 rows above and below the viewport.
- Top and bottom spacer `<tr>` elements maintain scroll position.
- `measureElement` ref is attached to each rendered row for accurate measurement after render.

## 11.2 Column Virtualization

- NOT implemented. All columns are rendered.
- Acceptable because column count is bounded (max ~8 columns).

## 11.3 View Caching

- `LocalAdapter` caches assembled `ReportView` objects in a `Map<string, ReportView>`.
- `SupabaseAdapter` caches in the same pattern.
- All views are preloaded during Supabase initialization, making drill synchronous.

## 11.4 Re-render Constraints

- `useMemo` guards `processedData` and `columns` computation.
- `useCallback` guards `handleActiveViewIdChange` and `handleTransactionClick`.
- Column definitions are only recomputed when `metric`, `nameHeader`, `showPeriod`, `isTransactionView`, or `handleTransactionClick` change.

## 11.5 Table Layout

- `table-layout: fixed` for predictable column widths.
- `border-spacing: 0` with `border-separate` for individual cell border control.

---

# 12. EDGE CASES

## 12.1 No Data

- If `getView(viewId)` returns `undefined`:
  - `displayData` = empty array
  - `kpi` = all zeros with empty reconciliation
  - Table renders "No results found for the current scope" message
- ViewState `"empty"` renders the same message.

## 12.2 Zero Budget

- Budget column displays "Excluded" (because `if (budget === 0) return "Excluded"`).
- Variance column displays "--".
- Variance % displays "--".
- Status: "Excluded".
- KPI percent: 0 when total budget is 0.

## 12.3 Zero Spend

- Normal rendering. Consumed shows 0.00.
- Variance equals budget (positive, healthy).

## 12.4 Excluded-Only Views

- All rows are excluded.
- KPI: budget=0, consumed=0, variance=0, percent=0, excludedSpend=sum of excluded spend.
- All budget columns show "Excluded", all variance show "--".
- excludedSpend line appears below Consumed KPI card.

## 12.5 Identical Values

- Budget equals consumed: variance=0, percent=0, status="Healthy".
- No special visual treatment.

## 12.6 Large Transaction Sets

- Virtualization handles rendering performance.
- Generated transaction views contain 3-4 rows per vendor/facility.
- In production, transaction views could contain hundreds of rows — virtualization would handle this.

## 12.7 Partial Timeframes

- Month to Date with today = March 20: shows partial month.
- Period expansion weights are deterministic and do not depend on partial vs full.

## 12.8 Negative Variance

- Row background: `bg-red-50/50`.
- KPI variance and percent: `text-red-600`, font weight 650.
- Status: "Over Budget" in `text-red-700`, font weight 600.

## 12.9 Custom Range Without Dates

- If custom range is selected but dates are not yet set, falls back to `{ start: Feb 1 2026, end: today }`.

## 12.10 Stale Filter/Sort State

- When switching views, column IDs may change (e.g., `name` ↔ `transactions`, `period` appears/disappears).
- `useEnterpriseGrid` filters out stale column IDs from `sorting` and `columnFilters` on every render.

---

# 13. NON-NEGOTIABLE RULES

1. **KPI is NOT derived from rows.** KPI values come exclusively from `DbView.kpi`, populated by `computeAuthoritativeKpi` which reads from `dbAggregates`.

2. **Rows MUST reconcile to KPI.** The drift guard (`computeKpiFromRows`) verifies this on every view assembly. Drift tolerance: $1.

3. **No business logic in UI.** The `EnterpriseGrid` component renders data — it does not compute KPI, derive variance, or aggregate values. All computation occurs in the repository/adapter layer.

4. **Aggregation happens in data layer only.** The data shaping pipeline (spend mode → timeframe → metric → period expansion) runs in `repository.getProcessedData`, not in React components.

5. **variance = budget - consumed.** Always. Everywhere. In `computeAuthoritativeKpi`, in `applyDataShaping`, in KPI display recalculation. Never stored independently, never overridden.

6. **consumed excludes excluded rows.** Always. In dbAggregates, in computeKpiFromRows, in all display paths.

7. **excludedSpend is separate and non-impacting.** It NEVER affects consumed, variance, percent, or sorting. It is a display-only informational field.

8. **Column pinning auto-switches.** When entering a transaction view, pinning switches to `["transactions"]`. When leaving, it switches back to `["name"]`.

9. **Pivot change resets drill state.** Changing pivotBy MUST reset activeViewId to the new pivot's root.

10. **Timeframe change resets viewBy.** Changing timeframe MUST set viewBy to `"fullTimeframe"`.

11. **Filter state is preserved across drill.** Stale column IDs are silently filtered out.

12. **Transaction links use stopPropagation.** Clicking a PO/Invoice/Accrual link MUST NOT trigger row drill.

13. **Overlay modal is a prototype boundary.** Transaction click opens a centered overlay with stub content. It is not a functional detail view.

---

# 14. AGGREGATION + RECONCILIATION CONTRACT

## 14.1 Grouping Rules Per Pivot Level

Each pivot defines which entity types appear at each drill level and how rows are grouped:

### Facility Pivot
| Level | Entity Type | Grouped By | Parent Scope |
|-------|-------------|------------|--------------|
| 0 (root) | Facility | All facilities | Entire organization |
| 1 | GL Account | GL accounts within one facility | Single facility |
| 2 | Vendor | Vendors within one GL account within one facility | Single facility + GL |
| 3 | Transaction | Transactions within one vendor within one GL within one facility | Single vendor scope |

### GL Account Pivot
| Level | Entity Type | Grouped By | Parent Scope |
|-------|-------------|------------|--------------|
| 0 (root) | GL Account | All GL accounts (cross-facility) | Entire organization |
| 1 | Vendor | Vendors within one GL account (cross-facility) | Single GL account |
| 2 | Transaction | Transactions within one vendor within one GL | Single vendor scope |

### Vendor Pivot
| Level | Entity Type | Grouped By | Parent Scope |
|-------|-------------|------------|--------------|
| 0 (root) | Vendor | All vendors (cross-facility) | Entire organization |
| 1 | Facility | Facilities within one vendor | Single vendor |
| 2 | Transaction | Transactions within one facility within one vendor | Single facility scope |

## 14.2 Aggregation Formulas

- **Method:** SUM only. No averaging, no weighted aggregation, no median.
- **Aggregation metadata** per row is stored in `DbAggregation`:
  - Non-transaction rows: `method: "SUM_CHILDREN"`, `childReconciliation: "MATCH"`
  - Transaction rows: `method: "DIRECT"`, `childReconciliation: "MATCH"`

### Fields Subject to Aggregation

| Field | Aggregation Rule |
|-------|-----------------|
| `budget` | SUM of non-excluded children's budget |
| `spend` (consumed) | SUM of non-excluded children's spend |
| `committed` | SUM of non-excluded children's committed |
| `variance` | DERIVED: `budget - consumed` (never summed independently) |
| `percent` | DERIVED: `Math.round((variance / budget) * 100)`, or 0 if budget = 0 |
| `excludedSpend` | SUM of excluded children's spend (separate aggregation track) |

### Variance Is Never Aggregated Directly

- Variance MUST be derived as `budget - consumed` at every level.
- Summing child variance values would produce the same result when the identity holds, but the system MUST NOT rely on this — variance is always recomputed from its components.

## 14.3 Excluded Handling During Aggregation

- Excluded rows are partitioned into a separate track during aggregation.
- Their `spend` values contribute to `excludedSpend`, NOT to `consumed`.
- Their `budget` is 0 (set by transform), so they contribute 0 to `budget`.
- Their `variance` is null and MUST NOT be summed.
- The parent's `consumed` and `budget` reflect ONLY non-excluded children.

### Aggregation Partition Rules

```
For a parent row P with children C[]:
  included_children = C.filter(c => !c.excluded)
  excluded_children = C.filter(c => c.excluded)

  P.budget    = SUM(included_children.map(c => c.budget))
  P.consumed  = SUM(included_children.map(c => c.spend))
  P.variance  = P.budget - P.consumed
  P.excludedSpend = SUM(excluded_children.map(c => c.spend))
```

## 14.4 Reconciliation Invariant

### Invariant 1: Child-to-Parent Reconciliation

For ANY non-transaction row R that has children in the next drill level:

```
SUM(non_excluded_child_rows.budget)    == R.budget
SUM(non_excluded_child_rows.spend)     == R.spend
SUM(non_excluded_child_rows.committed) == R.committed
```

For excluded parent rows:
```
SUM(child_rows.spend)     == R.spend       (all children are also excluded)
SUM(child_rows.committed) == R.committed
```

### Invariant 2: Top-Level Row-to-KPI Reconciliation

For the root view of any pivot:

```
SUM(non_excluded_root_rows.budget) == KPI.budget
SUM(non_excluded_root_rows.spend)  == KPI.consumed
KPI.variance == KPI.budget - KPI.consumed
SUM(excluded_root_rows.spend)      == KPI.excludedSpend
```

### Invariant 3: Transaction Sum Reconciliation

For any vendor/facility row V that drills into transactions:

```
SUM(transaction_rows.budget)    == V.budget     (when non-excluded)
SUM(transaction_rows.spend)     == V.spend
SUM(transaction_rows.committed) == V.committed
```

Transaction views inherit KPI from the parent row:
```
txn_view.KPI.budget    == V.budget  (or 0 if excluded)
txn_view.KPI.consumed  == V.spend   (or 0 if excluded)
txn_view.KPI.excludedSpend == V.spend (if excluded, else 0)
```

### Invariant 4: Arithmetic Identity (Universal)

At EVERY scope — root, intermediate, leaf, and transaction:

```
variance == budget - consumed
```

No exceptions. No stored overrides. This identity MUST hold after every transformation (spend mode, timeframe multiplier, metric division).

## 14.5 Reconciliation Enforcement

- **Build-time:** Seed data (`db-seed.tsx`) constructs rows and aggregates such that all invariants hold by construction. Transaction rows are generated with values that sum exactly to the parent row.
- **Runtime:** The drift guard in `assembleReportView` compares `computeKpiFromRows` output against authoritative KPI with $1 tolerance. Violations are logged as `[KPI_DRIFT]` warnings.
- **Reconciliation metadata:** `DbKpiReconciliation` tracks `rowCount`, `includedRows`, `excludedRows`, and a `checksum` for each view's KPI.

---

# 15. DRILL STATE MODEL

## 15.1 State Shape

```typescript
// Drill state is a single string — the currently active view ID.
activeViewId: string   // e.g., "fac-root", "fac-northridge-gl", "fac-nr-gl6100-vendor"
```

- There is NO drill stack, NO history array, NO depth counter.
- The current position in the hierarchy is fully encoded by `activeViewId`.
- Breadcrumb path is derived from the view's `DbBreadcrumbSegment` records, not from accumulated state.

## 15.2 State Transitions

| Trigger | Action | New `activeViewId` |
|---------|--------|-------------------|
| Row click (drillable) | `onActiveViewIdChange(row.childViewId)` | `row.childViewId` |
| Breadcrumb click | `onActiveViewIdChange(segment.viewId)` | `segment.viewId` |
| Pivot change | `onActiveViewIdChange(PIVOT_ROOT_VIEW[newPivot])` | Root view for new pivot |
| Initial mount | Set from default | `"fac-root"` |
| Supabase init complete | No change to activeViewId | Unchanged |

### Transition Side Effects

| Transition | Side Effects |
|------------|-------------|
| Any drill (row click) | `selectedRowName` set to clicked row name; audit event emitted |
| Breadcrumb click | `selectedRowName` reset to null |
| Pivot change | `activeViewId` reset to pivot root; `selectedRowName` implicitly stale |
| Transaction link click | `e.stopPropagation()` — drill does NOT occur; overlay opens instead |

## 15.3 Reset Rules

1. **Pivot change MUST reset to root.** When `pivotBy` changes, `activeViewId` MUST be set to `PIVOT_ROOT_VIEW[newPivot]`. Drill state from the previous pivot MUST NOT carry over.

2. **Timeframe change MUST NOT reset drill.** The user's drill position is preserved across timeframe changes. Only the data values change.

3. **Metric change MUST NOT reset drill.** Same as timeframe.

4. **Spend mode change MUST NOT reset drill.** Same as timeframe.

5. **ViewBy change MUST NOT reset drill.** Same as timeframe. Period expansion/collapse is orthogonal to drill position.

6. **Facility scope change MUST NOT reset drill.** Facility scope only filters root-level rows when `pivotBy === "facility"`.

## 15.4 View Resolution

- `activeViewId` is resolved to a `ReportView` via `repository.getView(activeViewId)`.
- If the view does not exist, `getProcessedData` returns empty defaults (see Section 12.1).
- All views are preloaded during initialization (both LocalAdapter cache and SupabaseAdapter preload), so resolution is synchronous.

## 15.5 Breadcrumb Derivation

- Breadcrumbs are NOT accumulated from drill history.
- Each view has pre-defined `DbBreadcrumbSegment` records with explicit positions and target view IDs.
- The breadcrumb for any view is self-contained and deterministic — it does not depend on how the user navigated to that view.

---

# 16. TIME BUCKET CONTRACT

## 16.1 Bucket Identity

Each time bucket is defined by a `DbTimeBucket` record:

```typescript
type DbTimeBucket = {
  id: string              // e.g., "W1", "W2", "W3"
  contextId: string       // Links to DbReportContext (e.g., "ctx-default")
  label: string           // Display label (e.g., "Week 1")
  startDate: string       // ISO date string (e.g., "2026-03-01")
  endDate: string         // ISO date string (e.g., "2026-03-07")
  position: number        // Sort order within context
}
```

- Bucket IDs are scoped to their context. The same ID (e.g., "W1") may appear in multiple contexts.
- The combination of `(id, contextId)` is unique.

## 16.2 Bucket Ordering

- Buckets MUST be ordered by `position` (ascending, 0-based).
- Within a context, position values are contiguous: 0, 1, 2, ...
- The UI MUST render buckets in position order. No client-side re-sorting of time buckets.

## 16.3 Row-Level Bucket Values

Each row has time bucket values stored in `DbRowTimeBucket`:

```typescript
type DbRowTimeBucket = {
  rowId: string           // Links to DbRow
  bucketId: string        // Links to DbTimeBucket.id
  total: number           // Total spend in this bucket
  actual: number          // Actual spend component
  commitment: number      // Commitment component
  deduplicated?: boolean  // Whether deduplication was applied
}
```

- A row MAY have values for zero, some, or all buckets in its context.
- Missing bucket values are treated as zero.

## 16.4 Alignment with KPI

- Time buckets are informational decompositions of row-level data.
- Time bucket values DO NOT determine KPI values.
- KPI is sourced from `dbAggregates` (independent aggregate layer).
- The sum of a row's time bucket totals SHOULD approximate the row's total spend, but this is NOT enforced as a hard constraint (rounding differences are acceptable).

## 16.5 Bucket Types

```typescript
bucketType: "DAY" | "WEEK" | "MONTH" | "QUARTER" | "FULL"
```

- Bucket type is metadata describing the granularity.
- The current seed data uses `WEEK` buckets (W1, W2, W3) for all three contexts.
- Bucket type does NOT affect the `viewBy` period expansion system — those are independent mechanisms. `viewBy` generates display periods; time buckets are governed decompositions stored on rows.

## 16.6 Context Scoping

- Each pivot has its own report context:
  - `ctx-default` (Facility pivot)
  - `ctx-gl` (GL Account pivot)
  - `ctx-vendor` (Vendor pivot)
- Time buckets are filtered by `contextId` when assembling a view.
- All views within a pivot share the same time bucket definitions.

## 16.7 Time Model

- All buckets use `timeModel: "CALENDAR"`.
- The system supports a single time model per bucket.
- `DbReportMeta.timeRuleSupportsMixedModels` indicates future capability but is not currently exercised.

---

# 17. SORTING CONTRACT

## 17.1 Sort Mechanism

- Sorting is managed by `@tanstack/react-table` via `getSortedRowModel`.
- Sort state is stored in `GridState.sorting` as an array of `{ id: string, desc: boolean }`.
- Multi-column sort is supported (array may contain multiple entries).

## 17.2 Sortable Columns

| Column | Sortable | Custom `sortingFn` |
|--------|----------|-------------------|
| `name` | Default (built-in) | No |
| `transactions` | Yes | No (alphanumeric default) |
| `period` | Yes | No (alphanumeric default) |
| `budget` | Yes (default enabled) | No |
| `consumed` | Yes (default enabled) | No |
| `variance` | Yes (default enabled) | No |
| `variancePercent` | Yes (explicit `enableSorting: true`) | YES |
| `census` | Yes (explicit `enableSorting: true`) | YES |
| `status` | Yes (explicit `enableSorting: true`) | YES |

## 17.3 Custom Sort Functions

### variancePercent

```typescript
sortingFn: (rowA, rowB, columnId) => {
  const a = rowA.getValue<number | null>(columnId) ?? 0
  const b = rowB.getValue<number | null>(columnId) ?? 0
  return a - b
}
```

- Null values are coerced to 0.
- Excluded rows (variancePercent = null) sort as 0.

### census

```typescript
sortingFn: (rowA, rowB) => {
  const a = rowA.original.census ?? []
  const b = rowB.original.census ?? []
  const sumA = a.reduce((s, c) => s + c.value, 0)
  const sumB = b.reduce((s, c) => s + c.value, 0)
  return sumA - sumB
}
```

- Sorts by sum of all census entry values.
- Empty census arrays sort as 0.

### status

```typescript
sortingFn: (rowA, rowB) => {
  const getOrder = (row) => {
    const budget = row.budget ?? 0
    const variance = row.variance ?? 0
    if (budget === 0) return 2       // Excluded
    if (variance < 0) return 0       // Over Budget
    return 1                          // Healthy
  }
  return getOrder(rowA.original) - getOrder(rowB.original)
}
```

- Fixed ordinal mapping: Over Budget (0) < Healthy (1) < Excluded (2).
- Ascending sort shows Over Budget first (highest priority).

## 17.4 Null Handling

| Column | Null Value | Sort Behavior |
|--------|-----------|---------------|
| `budget` | Excluded rows: 0 | Sorts as 0 (lowest in ascending) |
| `variance` | Excluded rows: mapped to `-(spend)` in `mapRowForTable` | Sorts as negative spend |
| `variancePercent` | Excluded rows: null | Coerced to 0 by custom sortingFn |
| `census` | No census: `[]` | Sum = 0 |
| `status` | N/A (always derived) | Ordinal sort |

## 17.5 Tie-Breaking

- All sortable columns use a deterministic tie-breaker via the `withLabelTieBreaker` wrapper.
- When two rows have identical values for the active sort key, the fallback sort is:
  ```
  label ASC (case-insensitive string comparison on row.original.name)
  ```
- This ensures:
  - Deterministic sorting across environments (no reliance on insertion order)
  - Consistent behavior between LocalAdapter and SupabaseAdapter (which may return rows in different orders)
  - No UI flicker or instability when data order differs between adapters or re-renders
- The `withLabelTieBreaker` helper wraps all custom `sortingFn` implementations and is also applied to columns that would otherwise use default numeric sort (budget, consumed, variance).

### Implementation

```typescript
function withLabelTieBreaker(compareFn: (rowA, rowB, columnId) => number) {
  return (rowA, rowB, columnId) => {
    const result = compareFn(rowA, rowB, columnId)
    if (result !== 0) return result
    const labelA = (rowA.original.name ?? "").toLowerCase()
    const labelB = (rowB.original.name ?? "").toLowerCase()
    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0
  }
}
```

## 17.6 Sort Direction Toggle

- Clicking a sortable column header cycles: unsorted → ascending → descending → unsorted.
- Sort indicator glyphs: `⇅` (unsorted, gray), `↑` (ascending), `↓` (descending).
- Toggle handler: `header.column.getToggleSortingHandler()`.

## 17.7 Stale Sort State

- When switching between views (e.g., drill from Facilities to GL Accounts), column IDs may change.
- `useEnterpriseGrid` filters `GridState.sorting` to remove entries whose `id` does not match any current column.
- This prevents sort state from referencing non-existent columns.

## 17.8 Sort Independence from KPI

- Sorting NEVER affects KPI values.
- Sorting operates on display rows only.
- `excludedSpend` MUST NOT be used as a sort key.

---

# 18. ADAPTER ARCHITECTURE

## 18.1 Interface

```typescript
interface ReportRepository {
  getView(viewId: string): ReportView | undefined
  getProcessedData(viewId: string, params: DataShapingParams): ProcessedViewData
  getFacilityNames(): string[]
}
```

## 18.2 Adapters

| Adapter | Source | Description |
|---------|--------|-------------|
| `LocalAdapter` | In-memory seed data (`db-seed.tsx`) | Default. Synchronous. Transforms via `assembleReportView`. |
| `SupabaseAdapter` | Supabase KV store via server API | Fetches `DbViewData` bundles from server, transforms through same `assembleReportView` pipeline. |

## 18.3 Switching

- On mount, App.tsx attempts Supabase initialization: seed → create adapter → preload → `setActiveAdapter`.
- If Supabase init fails, LocalAdapter remains active.
- `repository` singleton delegates all calls to `activeAdapter`.

## 18.4 Server API Routes

- Base URL: `https://${projectId}.supabase.co/functions/v1/make-server-b98afb97/report`
- All requests use `Authorization: Bearer ${publicAnonKey}`.

## 18.5 Data Flow

```
dbAggregates → computeAuthoritativeKpi → DbView.kpi
dbRows + related records → assembleReportView → ReportView
ReportView → getProcessedData → mapRowForTable + applyDataShaping → ProcessedViewData
ProcessedViewData → EnterpriseGrid (display only)
```

---

# 19. TRANSACTION OVERLAY MODAL

## 19.1 Trigger

- Clicking a blue underlined PO, Invoice, or Manual Accrual link in the Transactions column.
- Link click calls `onTransactionClick(label)` after `e.stopPropagation()`.

## 19.2 State

- `overlayTransaction: string | null` in App.tsx.
- `null` = modal closed.
- String = modal open with that label.

## 19.3 Display

- Fixed overlay: `position: fixed`, full screen, `z-index: 50`.
- Background: `rgba(0,0,0,0.4)`.
- Centered white card: `max-w-md`, `rounded-[6px]`, shadow.
- Header: "Prototype Boundary" (bold), close button (X).
- Body content:
  - For accruals (label starts with "ACCRUAL:"): Shows accrual name, stub text, expected field list.
  - For transactions: Shows label, stub text.
- Footer: "Close" button (`#005390` background, white text).

## 19.4 Dismissal

- Click overlay background.
- Click close button (header or footer).
- Sets `overlayTransaction` to `null`.

---

# 20. REPORT CONTROL BAR LAYOUT

## 20.1 Structure

- Sticky `left: 0`, full width.
- Blue bottom border (1px `#005390`).
- Controls rendered as native `<select>` dropdowns with custom styling.
- Each control has: label (11.5px, `#5a6178`, Nunito Sans 700) + 42px tall dropdown container.

## 20.2 Control Order (left to right)

1. Pivot By (176px)
2. Timeframe (176px) — with DateRangePickerPopover
3. Breakdown By (176px) — options filtered by timeframe validity
4. Metric (176px)
5. Spend Mode (176px)
6. [flex spacer]
7. Table Size (160px, right-aligned)

## 20.3 Dropdown Styling

- Background: white, `rounded-[6px]`.
- Border: 1px `#c0c5d4`.
- Text: 14px, Nunito Sans 600.
- Chevron: 14px SVG, `#8b90a0`, positioned right.
- `appearance: none` on select element.

---

*End of execution requirements document.*