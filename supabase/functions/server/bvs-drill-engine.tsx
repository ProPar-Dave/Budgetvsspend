/**
 * BVS Query Engine (Perspective-Based) — Ship 5 Phase 2
 *
 * Engine handler.
 *
 * Single entry point that subsumes all per-path build functions
 * (buildFacilityRoot, buildFacilityGlDrill, ..., buildVendorFacTxnDrill).
 * Wires the planner + renderer + column resolver into a real handler
 * that produces the standard view payload.
 *
 * Pipeline:
 *   1. parseDrillRequest       — query params → BuildLogicalPlanInput
 *   2. buildLogicalPlan        — pure (Phase 1.2)
 *   3. renderSQL               — pure (Phase 1.3)
 *   4. executePlan             — real I/O against Postgres
 *   5. shapeRows               — raw rows → typed row objects with labels
 *   6. attachPPDFromPlan       — applies ppdRowRule and ppdKpiRule
 *   7. computeKpi              — aggregate the row set
 *   8. buildBreadcrumbs        — derive crumb chain from path + filterStack
 *   9. buildDrills             — derive next-stage drill targets
 *  10. attachLineage           — two-layer lineage on every row
 *  11. wrapResponse            — standard view payload shape
 *
 * Cross-references:
 *   - Ship 5 v3 spec §2.3 (engine endpoint contract)
 *   - Phase 1 deliverables: registry, planner, renderer, column resolver
 *   - Existing helpers reused: attachRowPPD, attachKpiPPD,
 *     fetchPeriodPersonDays, makeContext, makeMeta from bvs-queries.tsx
 */

import {
  type DimensionId,
  type Filter,
  type LogicalPlan,
  type Lineage,
  type Perspective,
  type SpendMode,
  PERSPECTIVE_DEFAULTS,
  getDimension,
} from "./bvs-drill-registry.tsx";
import { buildLogicalPlan, type BuildLogicalPlanInput } from "./bvs-drill-planner.tsx";
import { renderSQL, type RenderedSQL } from "./bvs-drill-renderer.tsx";
import { resolveColumns } from "./bvs-drill-column-resolver.tsx";
import {
  type SqlClient,
  attachRowPPD,
  attachKpiPPD,
  fetchFacilityPersonDays,
  makeContext,
  makeMeta,
  buildPeriodBreakdown,
} from "./bvs-queries.tsx";

// ============================================================================
// Public entry point
// ============================================================================

const COMPOSER_VERSION = "engine-v1.0.0";

export type DrillRequest = {
  path: DimensionId[];
  filterStack: Filter[];
  timeframe: { start: string; end: string };
  spendMode: SpendMode;
  /** When true, response includes plan + SQL in a debug field. */
  debug: boolean;
};

export type DrillResponse = {
  view: any;
  context: any;
  meta: any;
  timeBuckets: any[];
  breadcrumbs: any[];
  rows: any[];
  rowTimeBuckets: any[];
  spendCompositions: any[];
  censusContexts: any[];
  decompositions: any[];
  lineages: any[];
  aggregations: any[];
  drills: any[];
  exclusions: any[];
  /** Present only when debug=true. */
  debug?: {
    plan: LogicalPlan;
    sql: RenderedSQL;
    composerVersion: string;
  };
};

/**
 * Run the drill engine for a parsed request. Returns the standard
 * view payload. Throws on planner errors (invalid path, unknown filter
 * column) and rethrows on SQL errors.
 *
 * Caller is responsible for HTTP framing (status codes, headers).
 */
export async function runDrillEngine(
  sql: SqlClient,
  request: DrillRequest,
): Promise<DrillResponse> {
  // 1-2. Plan
  const plan = buildLogicalPlan({
    path: request.path,
    filterStack: request.filterStack,
    timeframe: request.timeframe,
    spendMode: request.spendMode,
  });

  // 3. Render
  const rendered = renderSQL(plan);

  // 4. Execute
  const { spendRows, budgetRows } = await executePlan(sql, rendered);

  // 5. Shape rows — merge spend and budget, apply labels, compute variance
  const rows = shapeRows(spendRows, budgetRows, plan);

  // 6. Attach PPD — uses existing helpers per ppdRowRule and ppdKpiRule
  const { totalPersonDays } = await attachPPDFromPlan(sql, rows, plan);

  // 7. Compute KPI
  const kpi = computeKpi(rows, plan, totalPersonDays);

  // 8. Breadcrumbs
  const breadcrumbs = buildBreadcrumbs(plan);

  // 9. Drills (per row)
  const drills = buildDrills(rows, plan);

  // 10. Lineage — attach to every row, also include in top-level lineages array
  const lineages = attachLineage(rows, plan);

  // 11. Wrap
  const response: DrillResponse = {
    view: {
      id: buildViewId(plan),
      contextId: `bvs-ctx-${plan.path[0]}`,
      metaId: "bvs-meta-1",
      scopeLabel: scopeLabel(plan),
      entityTypeLabel: entityTypeLabel(plan),
      kpi: { ...kpi, totalPersonDays },
    },
    context: makeContext(plan.path[0]),
    meta: makeMeta(),
    timeBuckets: [],
    breadcrumbs,
    rows,
    rowTimeBuckets: [],
    spendCompositions: [],
    censusContexts: [],
    decompositions: [],
    lineages,
    aggregations: [],
    drills,
    exclusions: [],
  };

  if (request.debug) {
    response.debug = {
      plan,
      sql: rendered,
      composerVersion: COMPOSER_VERSION,
    };
  }

  return response;
}

// ============================================================================
// Request parsing — exposed for the route handler in index.tsx
// ============================================================================

/**
 * Parse a drill request from URL search params. Used by the route
 * handler. Returns null on malformed input; the caller returns 400.
 *
 * Expected params:
 *   path           — dot-separated dimension chain, e.g. "facility.gl"
 *   filter[<col>]  — comma-separated values, e.g. "X" or "X,Y,Z"
 *   start, end     — ISO date strings
 *   spendMode      — "totalImpact" | "actual" | "commitment"
 *   debug          — "true" or absent
 */
export function parseDrillRequest(searchParams: URLSearchParams): DrillRequest | null {
  const pathStr = searchParams.get("path");
  if (!pathStr) return null;
  const path = pathStr.split(".") as DimensionId[];

  const filterStack: Filter[] = [];
  for (const [key, value] of searchParams) {
    const m = key.match(/^filter\[([^\]]+)\]$/);
    if (m) {
      const values = value.split(",").filter(v => v.length > 0);
      if (values.length > 0) {
        filterStack.push({ column: m[1], values });
      }
    }
  }

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) return null;

  const spendMode = (searchParams.get("spendMode") ?? "totalImpact") as SpendMode;
  const debug = searchParams.get("debug") === "true";

  return {
    path,
    filterStack,
    timeframe: { start, end },
    spendMode,
    debug,
  };
}

// ============================================================================
// Periods runner — Phase 4 addition for /bvs/drill/periods
// ============================================================================

/**
 * Period breakdown request (monthly/quarterly viewBy across drill rows).
 * Same shape as DrillRequest plus viewBy. No `debug` flag — periods endpoint
 * doesn't expose plan/SQL, since it delegates to the legacy buildPeriodBreakdown
 * pipeline. Phase 4.5 may consolidate this if a unified period-aware engine
 * pipeline lands.
 */
export type DrillPeriodsRequest = {
  path: DimensionId[];
  filterStack: Filter[];
  timeframe: { start: string; end: string };
  spendMode: SpendMode;
  viewBy: "monthly" | "quarterly";
};

export type DrillPeriodsResponse = {
  path: string;
  viewBy: string;
  startDate: string;
  endDate: string;
  periods: any;
};

/**
 * Run the periods pipeline for a drill request. Validates the path through
 * the planner (Cross-Perspective Numerical Invariance preserved at the path
 * level), then translates the engine path/filterStack into the legacy viewId
 * format consumed by buildPeriodBreakdown.
 *
 * The translation step is intentional — it keeps the legacy period builders
 * as the source of truth for per-period spend/budget/PPD math while exposing
 * the engine's path-based interface to the client. Phase 4 introduces 4 new
 * legacy viewId patterns (bvs-gl-{G}-fac, bvs-gl-{G}-fac-{F}-vendor,
 * bvs-vendor-{V}-gl, bvs-vendor-{V}-gl-{G}-fac) for the Option B canonical
 * orderings G→F→V→T and V→G→F→T.
 */
export async function runDrillPeriodsEngine(
  sql: SqlClient,
  request: DrillPeriodsRequest,
): Promise<DrillPeriodsResponse> {
  // Validate path through the planner (throws on invalid path).
  const plan = buildLogicalPlan({
    path: request.path,
    filterStack: request.filterStack,
    timeframe: request.timeframe,
    spendMode: request.spendMode,
  });

  // Translate to legacy viewId for buildPeriodBreakdown dispatch.
  const legacyViewId = engineToLegacyViewId(plan);

  // txn leaves don't have meaningful period breakdowns (transactions already
  // carry txn_date). Return empty PeriodMap rather than throwing — matches
  // legacy behavior at line 1611 of bvs-queries.tsx.
  if (legacyViewId === null) {
    return {
      path: plan.path.join("."),
      viewBy: request.viewBy,
      startDate: plan.timeframe.start,
      endDate: plan.timeframe.end,
      periods: {},
    };
  }

  const periods = await buildPeriodBreakdown(
    sql,
    legacyViewId,
    request.viewBy,
    plan.timeframe.start,
    plan.timeframe.end,
    plan.spendMode,
    true, // wantPPD — engine periods always return enriched (V3 doctrine PPD)
  );

  return {
    path: plan.path.join("."),
    viewBy: request.viewBy,
    startDate: plan.timeframe.start,
    endDate: plan.timeframe.end,
    periods,
  };
}

/**
 * Translate a Logical Plan into the legacy viewId format that
 * buildPeriodBreakdown dispatches on. Returns null for paths that don't
 * have a meaningful period breakdown (txn leaves).
 *
 * Maps engine canonical paths to legacy viewIds:
 *   facility                    → bvs-fac-root
 *   facility.gl                 → bvs-fac-{F}-gl
 *   facility.gl.vendor          → bvs-fac-{F}-gl-{G}-vendor
 *   facility.gl.vendor.txn      → null (no period breakdown for txn leaf)
 *   gl                          → bvs-gl-root
 *   gl.facility                 → bvs-gl-{G}-fac        (NEW — Phase 4 Option B)
 *   gl.facility.vendor          → bvs-gl-{G}-fac-{F}-vendor (NEW)
 *   gl.facility.vendor.txn      → null
 *   vendor                      → bvs-vendor-root
 *   vendor.gl                   → bvs-vendor-{V}-gl     (NEW — Phase 4 Option B)
 *   vendor.gl.facility          → bvs-vendor-{V}-gl-{G}-fac (NEW)
 *   vendor.gl.facility.txn      → null
 */
function engineToLegacyViewId(plan: LogicalPlan): string | null {
  const p = plan.path;
  const f = (col: string): string | null => {
    const filter = plan.filterStack.find(x => x.column === col);
    return filter && filter.values.length > 0 ? filter.values[0] : null;
  };

  // Single-element paths (perspective roots).
  if (p.length === 1) {
    if (p[0] === "facility") return "bvs-fac-root";
    if (p[0] === "gl") return "bvs-gl-root";
    if (p[0] === "vendor") return "bvs-vendor-root";
    return null;
  }

  // Facility perspective: facility → gl → vendor → txn
  if (p[0] === "facility") {
    const F = f("facility_id");
    if (!F) return null;
    if (p.length === 2 && p[1] === "gl") return `bvs-fac-${F}-gl`;
    const G = f("gl_account_id");
    if (!G) return null;
    if (p.length === 3 && p[2] === "vendor") return `bvs-fac-${F}-gl-${G}-vendor`;
    return null; // txn leaf or unrecognized
  }

  // GL perspective: gl → facility → vendor → txn (Phase 4 Option B canonical)
  if (p[0] === "gl") {
    const G = f("gl_account_id");
    if (!G) return null;
    if (p.length === 2 && p[1] === "facility") return `bvs-gl-${G}-fac`;
    const F = f("facility_id");
    if (!F) return null;
    if (p.length === 3 && p[2] === "vendor") return `bvs-gl-${G}-fac-${F}-vendor`;
    return null;
  }

  // Vendor perspective: vendor → gl → facility → txn (Phase 4 Option B canonical)
  if (p[0] === "vendor") {
    const V = f("vendor_id");
    if (!V) return null;
    if (p.length === 2 && p[1] === "gl") return `bvs-vendor-${V}-gl`;
    const G = f("gl_account_id");
    if (!G) return null;
    if (p.length === 3 && p[2] === "facility") return `bvs-vendor-${V}-gl-${G}-fac`;
    return null;
  }

  return null;
}

/**
 * Parse a periods request from URL search params. Same shape as
 * parseDrillRequest plus required `viewBy`. Returns null on malformed input.
 */
export function parseDrillPeriodsRequest(
  searchParams: URLSearchParams,
): DrillPeriodsRequest | null {
  const base = parseDrillRequest(searchParams);
  if (!base) return null;
  const viewBy = searchParams.get("viewBy");
  if (viewBy !== "monthly" && viewBy !== "quarterly") return null;
  return {
    path: base.path,
    filterStack: base.filterStack,
    timeframe: base.timeframe,
    spendMode: base.spendMode,
    viewBy: viewBy as "monthly" | "quarterly",
  };
}

// ============================================================================
// Step 4 — Execute the planned SQL
// ============================================================================

async function executePlan(
  sql: SqlClient,
  rendered: RenderedSQL,
): Promise<{ spendRows: any[]; budgetRows: any[] }> {
  // Run spend and budget queries in parallel where both exist.
  // postgres-js client uses .unsafe() for non-parameterized raw SQL.
  const [spendRows, budgetRows] = await Promise.all([
    sql.unsafe(rendered.spend),
    rendered.budget ? sql.unsafe(rendered.budget) : Promise.resolve([]),
  ]);

  return {
    spendRows: spendRows ?? [],
    budgetRows: budgetRows ?? [],
  };
}

// ============================================================================
// Step 5 — Shape rows: merge spend + budget, assemble labels, compute variance
// ============================================================================

function shapeRows(spendRows: any[], budgetRows: any[], plan: LogicalPlan): any[] {
  const groupByDim = getDimension(plan.groupBy);

  // For txn leaf: rows are already shaped; just normalize field names.
  if (plan.groupBy === "txn") {
    return spendRows.map(r => ({
      id: r.id,
      txnDate: r.txn_date,
      amount: Number(r.amount_actual ?? 0),
      committed: Number(r.amount_committed ?? 0),
      excluded: Boolean(r.excluded),
      glExcluded: Boolean(r.gl_excluded),
      reference: r.reference ?? null,
      poNumber: r.po_number ?? null,
      invoiceNumber: r.invoice_number ?? null,
      txnType: r.txn_type ?? null,
    }));
  }

  // Merge spend + budget on entity_id.
  const budgetByEntity = new Map<string, number>();
  const excludedByEntity = new Map<string, boolean>();
  for (const b of budgetRows) {
    const id = String(b.entity_id);
    budgetByEntity.set(id, Number(b.total_budget ?? 0));
    if (b.gl_excluded !== undefined) {
      excludedByEntity.set(id, Boolean(b.gl_excluded));
    }
  }

  return spendRows.map(s => {
    const id = String(s.entity_id);
    const spend = Number(s.total_spend ?? 0);
    const committed = Number(s.total_committed ?? 0);
    const budget = budgetByEntity.get(id) ?? 0;
    const variance = budget - spend;
    const variancePercent = budget !== 0 ? (variance / budget) * 100 : null;

    // Label assembly. The renderer SELECTs labelColumns as
    // `${alias}_${col}` (e.g. g_code, g_name, f_name, v_name).
    const label = assembleLabel(s, groupByDim);

    // Excluded flag: gl rows surface g.excluded; otherwise default false.
    const excluded =
      groupByDim.id === "gl"
        ? Boolean(s.gl_excluded ?? excludedByEntity.get(id) ?? false)
        : false;

    return {
      id,
      entityType: groupByDim.id,
      label,
      budget,
      consumed: spend,
      committed,
      variance,
      variancePercent,
      txnCount: Number(s.txn_count ?? 0),
      excluded,
      // PPD fields populated in step 6
    };
  });
}

function assembleLabel(rawRow: any, groupByDim: ReturnType<typeof getDimension>): string {
  const lj = groupByDim.labelJoin;
  if (!lj) return String(rawRow.entity_id);
  const parts = lj.labelColumns.map(col => rawRow[`${lj.alias}_${col}`] ?? "");
  // GL composite: "code - name". Single-column dims: just the value.
  if (parts.length === 1) return String(parts[0]);
  return parts.filter(p => p).join(" - ");
}

// ============================================================================
// Step 6 — PPD attachment per ppdRowRule and ppdKpiRule
// ============================================================================

async function attachPPDFromPlan(
  sql: SqlClient,
  rows: any[],
  plan: LogicalPlan,
): Promise<{ totalPersonDays: number }> {
  // Resolve which facilities matter for the PD lookup:
  //   - Explicit facility filter → those facilities only
  //   - groupBy=facility (no filter) → each row IS a facility, look up all of them
  //   - Otherwise (gl-root, vendor-root, etc.) → portfolio scope (null)
  const facilityFilter = plan.filterStack.find(f => f.column === "facility_id");
  let facilityIds: string[] | null = null;
  if (facilityFilter) {
    facilityIds = facilityFilter.values;
  } else if (plan.groupBy === "facility") {
    facilityIds = rows.map(r => String(r.id));
  }
  // facilityIds === null when scope is portfolio (e.g. gl-root, vendor-root).

  // No PPD needed at all — short-circuit to avoid unnecessary DB call.
  if (plan.ppdRowRule === "none" && plan.ppdKpiRule === "none") {
    return { totalPersonDays: 0 };
  }

  // Single DB roundtrip: one census query returns the full per-facility map.
  const facilityPdMap = await fetchFacilityPersonDays(
    sql,
    plan.timeframe.start,
    plan.timeframe.end,
    facilityIds,
  );

  // KPI denominator is the sum of the map's values.
  const totalPersonDays = Object.values(facilityPdMap).reduce((a, b) => a + b, 0);

  // Row-level PPD attachment per ppdRowRule.
  if (plan.ppdRowRule === "none") {
    // txn leaf — no PPD on rows. KPI handled by caller (computeKpi).
    return { totalPersonDays };
  }

  if (plan.groupBy === "facility") {
    // Each row IS a facility — look up its PD from the map.
    for (const row of rows) {
      attachRowPPD(row, facilityPdMap[String(row.id)] ?? 0);
    }
    return { totalPersonDays };
  }

  if (plan.ppdRowRule === "facility-scoped" && facilityFilter && facilityFilter.values.length === 1) {
    // All rows inherit the single filtered facility's PD.
    const facilityPd = facilityPdMap[facilityFilter.values[0]] ?? 0;
    for (const row of rows) attachRowPPD(row, facilityPd);
    return { totalPersonDays };
  }

  // subset-scoped or portfolio-shared: all rows share the total denominator.
  for (const row of rows) attachRowPPD(row, totalPersonDays);
  return { totalPersonDays };
}

// ============================================================================
// Step 7 — KPI computation
// ============================================================================

function computeKpi(rows: any[], plan: LogicalPlan, totalPersonDays: number): any {
  if (plan.groupBy === "txn") {
    // Leaf: KPI is sum of transaction amounts per spend mode.
    const consumed = rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);
    const committed = rows.reduce((acc, r) => acc + (r.committed ?? 0), 0);
    const kpi: any = { budget: 0, consumed, committed, variance: -consumed, variancePercent: null, excludedSpend: 0 };
    if (plan.ppdKpiRule !== "none") attachKpiPPD(kpi, totalPersonDays);
    return kpi;
  }

  const budget = rows.reduce((acc, r) => acc + (r.excluded ? 0 : r.budget ?? 0), 0);
  const consumed = rows.reduce((acc, r) => acc + (r.excluded ? 0 : r.consumed ?? 0), 0);
  const committed = rows.reduce((acc, r) => acc + (r.committed ?? 0), 0);
  const excludedSpend = rows.reduce((acc, r) => acc + (r.excluded ? r.consumed ?? 0 : 0), 0);
  const variance = budget - consumed;
  const variancePercent = budget !== 0 ? (variance / budget) * 100 : null;

  const kpi: any = { budget, consumed, committed, variance, variancePercent, excludedSpend };
  if (plan.ppdKpiRule !== "none") attachKpiPPD(kpi, totalPersonDays);
  return kpi;
}

// ============================================================================
// Step 8 — Breadcrumbs from path + filterStack
// ============================================================================

function buildBreadcrumbs(plan: LogicalPlan): any[] {
  const crumbs: any[] = [];
  // Walk the path. Each path stage becomes one crumb.
  for (let i = 0; i < plan.path.length; i++) {
    const dimId = plan.path[i];
    const subPath = plan.path.slice(0, i + 1);

    // viewId for this stage uses the path-prefix.
    const viewId = buildViewIdForPath(subPath, plan.filterStack);

    // Label for the crumb.
    let label: string;
    if (i === 0) {
      // Root crumb — the perspective name.
      label = scopeLabel({ ...plan, path: subPath });
    } else {
      // Intermediate crumb — "{parent dim's filter value label}" or generic.
      // For now, generic dimension label (e.g., "GL Account"). UI can resolve
      // labels for filtered values by calling a helper if needed.
      label = getDimension(dimId).label;
    }

    crumbs.push({
      viewId,
      position: i,
      label,
      targetViewId: i === plan.path.length - 1 ? null : viewId,
    });
  }
  return crumbs;
}

// ============================================================================
// Step 9 — Drills per row
// ============================================================================

function buildDrills(rows: any[], plan: LogicalPlan): any[] {
  // Determine the next stage in the perspective.
  const perspective = plan.path[0] as Perspective;
  const canonical = PERSPECTIVE_DEFAULTS[perspective];
  const currentDepth = plan.path.length;

  // If we're already at the txn leaf, no further drill.
  if (plan.groupBy === "txn" || currentDepth >= canonical.length) {
    return rows.map(r => ({ rowId: r.id, nextPivot: null, available: false }));
  }

  const nextDim = canonical[currentDepth];
  const nextLabel = getDimension(nextDim).label;

  return rows.map(r => ({
    rowId: r.id,
    nextPivot: nextLabel,
    available: !r.excluded, // Excluded rows can't be drilled (existing pattern)
  }));
}

// ============================================================================
// Step 10 — Lineage attachment
// ============================================================================

function attachLineage(rows: any[], plan: LogicalPlan): Lineage[] {
  const filterStackMap: Record<string, string | string[]> = {};
  for (const f of plan.filterStack) {
    filterStackMap[f.column] = f.values.length === 1 ? f.values[0] : f.values;
  }

  const computation = {
    filterStack: filterStackMap,
    source: "BVS_KERNEL_V3" as const,
    composerVersion: COMPOSER_VERSION,
    computed: {
      spend: plan.computedFields.includes("spend"),
      budget: plan.computedFields.includes("budget"),
      ppd: plan.computedFields.includes("ppd"),
    },
  };

  const perspective = plan.path[0] as Perspective;

  return rows.map(row => {
    const lineage: Lineage = {
      computation,
      traversal: {
        perspective,
        parentId: deriveParentId(plan),
        aggregationPath: deriveAggregationPath(plan, row),
      },
    };
    // Attach to row itself for client convenience.
    row.lineage = lineage;
    return lineage;
  });
}

function deriveParentId(plan: LogicalPlan): string | null {
  // Parent is the previous step in the path. For root paths, no parent.
  if (plan.path.length <= 1) return null;
  const parentPath = plan.path.slice(0, -1);
  return buildViewIdForPath(parentPath, plan.filterStack);
}

function deriveAggregationPath(plan: LogicalPlan, row: any): string[] {
  // Canonical (perspective-independent) path through the hierarchy.
  // e.g. ["portfolio", "fac:cottonwood", "gl:6100"]
  const segments: string[] = ["portfolio"];
  for (const f of plan.filterStack) {
    const dim = (() => {
      if (f.column === "facility_id") return "fac";
      if (f.column === "gl_account_id") return "gl";
      if (f.column === "vendor_id") return "ven";
      return f.column;
    })();
    segments.push(`${dim}:${f.values.join(",")}`);
  }
  // Add the current row as the final segment.
  if (plan.groupBy !== "txn") {
    segments.push(`${plan.groupBy}:${row.id}`);
  }
  return segments;
}

// ============================================================================
// ViewId construction
// ============================================================================

function buildViewId(plan: LogicalPlan): string {
  return buildViewIdForPath(plan.path, plan.filterStack);
}

function buildViewIdForPath(path: DimensionId[], filterStack: Filter[]): string {
  // Engine-native viewId format: "drill:facility.gl?facility_id=X"
  const filterPart = filterStack.length > 0
    ? "?" + filterStack
        .map(f => `${f.column}=${f.values.join(",")}`)
        .join("&")
    : "";
  return `drill:${path.join(".")}${filterPart}`;
}

// ============================================================================
// Display labels for view metadata
// ============================================================================

function scopeLabel(plan: LogicalPlan): string {
  const groupByDim = getDimension(plan.groupBy);
  if (plan.path.length === 1) {
    // Root — pluralize.
    return `${groupByDim.label}s`;
  }
  return groupByDim.label;
}

function entityTypeLabel(plan: LogicalPlan): string {
  return scopeLabel(plan);
}