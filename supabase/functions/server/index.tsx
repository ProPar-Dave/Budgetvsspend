import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildFacilityRoot, buildFacilityGlDrill, buildFacilityGlVendorDrill, buildFacilityGlVendorTxnDrill,
  buildGlRoot, buildGlVendorDrill, buildGlVendorTxnDrill,
  buildVendorRoot, buildVendorFacDrill, buildVendorFacTxnDrill,
  getFacilityNames as bvsGetFacilityNames,
  buildPeriodBreakdown,
  buildSparklineData,
  attachRowPPD,
} from "./bvs-queries.tsx";
import type { SpendMode } from "./bvs-queries.tsx";
import { resolveDateRange, yearRange } from "./bvs-queries.tsx";
// Ship 5 Phase 2: BVS Query Engine (Perspective-Based)
import { runDrillEngine, parseDrillRequest, runDrillPeriodsEngine, parseDrillPeriodsRequest } from "./bvs-drill-engine.tsx";

// Ship 4a: strip enriched fields from a view result for the legacy shape.
// Mutates in place for efficiency — the result object is about to be
// serialized and discarded, so the mutation is safe.
function stripEnrichedFields(result: any): void {
  if (result?.rows && Array.isArray(result.rows)) {
    for (const row of result.rows) {
      delete row.spendPPD;
      delete row.budgetPPD;
      delete row.variancePPD;
    }
  }
  if (result?.view?.kpi) {
    delete result.view.kpi.spendPPD;
    delete result.view.kpi.budgetPPD;
    delete result.view.kpi.variancePPD;
  }
}

// ---------------------------------------------------------------------------
// Phase 4b: engine → legacy view shape shim
//
// Bridges the gap between the canonical engine response (DrillResponse) and
// the legacy view shape that the BVS adapter's transformRow/transformKpi
// expect. Additive: original engine fields are preserved alongside their
// legacy-named twins (e.g. `consumed` stays, `spend` is added). Mutates in
// place; result is about to be serialized.
//
// Field deltas covered:
//   view.kpi:  + percent (← variancePercent), + status, + reconciliation,
//              + id, + viewId
//   rows:      + entityId (← id), + spend (← consumed), capitalize entityType,
//              + status, + childViewId, + viewId, defaults for po/invoice/txnType
//   txn rows:  full remap — engine emits {amount, txnDate, reference,
//              poNumber, invoiceNumber}; legacy expects {spend, lastTxnDate,
//              label, po, invoice}
//
// Out of scope (graceful absence in adapter):
//   - row.trendSpend / row.trendBudgetAvg (sparkline inline cache no-ops)
//   - row.personDays per facility (passed through as undefined)
//   - kpi.monthlyPersonDays, kpi.projectionStatus
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABEL: Record<string, string> = {
  facility: "Facility",
  gl: "GL Account",
  vendor: "Vendor",
  txn: "Transaction",
};

// Phase 4b QA — proper pluralization (engine's naive +s yielded "Facilitys").
const PLURAL_LABEL_MAP: Record<string, string> = {
  "Facility": "Facilities",
  "GL Account": "GL Accounts",
  "Vendor": "Vendors",
  "Transaction": "Transactions",
};
function pluralizeLabel(label: string): string {
  return PLURAL_LABEL_MAP[label] ?? `${label}s`;
}

// Map dimension id → its filter column on bvs.transactions.
const DIM_TO_FILTER_COL: Record<string, string> = {
  facility: "facility_id",
  gl: "gl_account_id",
  vendor: "vendor_id",
};

// Canonical drill orderings per perspective (mirrors PERSPECTIVE_DEFAULTS
// in bvs-drill-registry.tsx). The engine planner rejects non-prefixes of
// these; childViewIds must therefore follow these orderings exactly.
const CANONICAL_ORDERING: Record<string, string[]> = {
  facility: ["facility", "gl", "vendor", "txn"],
  gl:       ["gl", "facility", "vendor", "txn"],
  vendor:   ["vendor", "gl", "facility", "txn"],
};

// Map a groupBy dimension to the filter column the engine expects.
const GROUPBY_FILTER_COL: Record<string, string> = {
  facility: "facility_id",
  gl: "gl_account_id",
  vendor: "vendor_id",
};

// Phase 4b QA — resolve filter entity_ids to display labels for breadcrumb
// and scope-label rendering. Returns a map keyed by filter column name to
// the human-readable entity label. Single-value filters only (UI never
// sends multi-value, matching legacy behavior). Three parallel PK lookups
// over tiny dimension tables — sub-millisecond each.
async function resolveFilterEntityLabels(
  sql: any,
  filterStack: Array<{ column: string; values: string[] }>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const facId = filterStack.find(f => f.column === "facility_id" && f.values.length === 1)?.values[0];
  const glId = filterStack.find(f => f.column === "gl_account_id" && f.values.length === 1)?.values[0];
  const venId = filterStack.find(f => f.column === "vendor_id" && f.values.length === 1)?.values[0];

  const [facRows, glRows, venRows] = await Promise.all([
    facId ? sql`SELECT name FROM bvs.facilities WHERE id = ${facId}` : Promise.resolve([]),
    glId ? sql`SELECT code, name FROM bvs.gl_accounts WHERE id = ${glId}` : Promise.resolve([]),
    venId ? sql`SELECT name FROM bvs.vendors WHERE id = ${venId}` : Promise.resolve([]),
  ]);

  if (facRows[0]) result.facility_id = facRows[0].name;
  if (glRows[0]) result.gl_account_id = `${glRows[0].code} - ${glRows[0].name}`;
  if (venRows[0]) result.vendor_id = venRows[0].name;

  return result;
}

// Legacy status labels — must match classifyStatus() in bvs-queries.tsx so
// the adapter's downstream consumers (transform.tsx, UI status pills) see
// the same values the legacy path produced. Thresholds match: variance% <
// -5 ⇒ over_budget; > +5 ⇒ under_budget; otherwise on_track. Rows with
// excluded=true always get "excluded". Rows with null variance% but
// excluded=false get "on_track" — matches the legacy vendor-root
// convention, where vendors carry no budget but are still rendered as
// healthy ("on_track") rather than struck-through.
function classifyStatusForShim(
  variancePercent: number | null | undefined,
  excluded: boolean,
): string {
  if (excluded) return "excluded";
  if (variancePercent === null || variancePercent === undefined || !isFinite(variancePercent)) {
    return "on_track";
  }
  if (variancePercent < -5) return "over_budget";
  if (variancePercent > 5) return "under_budget";
  return "on_track";
}

// Build a child viewId in the engine's drill: format using the perspective's
// canonical ordering. Returns null when we're already at a leaf (txn) or
// when the path is somehow off-canonical (defensive).
//
// Examples:
//   path=["facility"], row=facA → "drill:facility.gl?facility_id=facA"
//   path=["gl"], row=glA       → "drill:gl.facility?gl_account_id=glA"
//   path=["vendor"], row=venA  → "drill:vendor.gl?vendor_id=venA"
//   path=["facility","gl"] facility_id=facA, row=glA
//                              → "drill:facility.gl.vendor?facility_id=facA&gl_account_id=glA"
function buildChildViewIdForShim(
  path: string[],
  filterStack: Array<{ column: string; values: string[] }>,
  rowEntityId: string,
  groupBy: string,
): string | null {
  const perspective = path[0];
  const canonical = CANONICAL_ORDERING[perspective];
  if (!canonical) return null;
  // Confirm current path is a prefix of canonical.
  for (let i = 0; i < path.length; i++) {
    if (path[i] !== canonical[i]) return null;
  }
  // Next dimension in the canonical ordering.
  const nextDim = canonical[path.length];
  if (!nextDim) return null;
  // Build filter list: keep existing single-value filters, add row's entityId
  // under the current groupBy's filter column. The engine's viewId format
  // uses ?col=val&col=val (no brackets) — buildEngineUrl on the client
  // re-encodes these into filter[col]=val for the actual request.
  const filters: Array<[string, string]> = [];
  for (const f of filterStack ?? []) {
    if (f.values?.length === 1) filters.push([f.column, f.values[0]]);
  }
  const newFilterCol = GROUPBY_FILTER_COL[groupBy];
  if (newFilterCol) filters.push([newFilterCol, rowEntityId]);
  const filterPart = filters.length > 0
    ? "?" + filters.map(([c, v]) => `${c}=${v}`).join("&")
    : "";
  const newPath = [...path, nextDim].join(".");
  return `drill:${newPath}${filterPart}`;
}

// Round 2 — fetch per-type person-days for a set of facilities (or portfolio
// when facilityIds === null). Returns { facility_id: { census_type: pd, ... } }.
// Mirrors fetchFacilityPersonDays from bvs-queries.tsx but adds the type
// grouping so CCRC facilities can be displayed as per-wing breakdowns. Single
// DB roundtrip, sub-millisecond on the indexed (facility_id, effective_date)
// columns. ACTUAL basis only — matches the existing PPD denominator policy.
async function fetchPersonDaysByType(
  sql: any,
  startDate: string,
  endDate: string,
  facilityIds: string[] | null,
): Promise<Record<string, Record<string, number>>> {
  let scopeClause = "";
  if (facilityIds !== null) {
    if (facilityIds.length === 0) return {};
    const list = facilityIds.map(s => `'${s}'`).join(", ");
    scopeClause = ` AND cd.facility_id IN (${list})`;
  }
  const rows = await sql.unsafe(`
    SELECT cd.facility_id, cd.census_type, SUM(cd.value) AS person_days
    FROM bvs.census_daily cd
    WHERE cd.effective_date >= '${startDate}'::date
      AND cd.effective_date <= '${endDate}'::date
      AND cd.basis = 'ACTUAL'
      ${scopeClause}
    GROUP BY cd.facility_id, cd.census_type
  `);
  const result: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const fid = String(r.facility_id);
    if (!result[fid]) result[fid] = {};
    result[fid][String(r.census_type)] = Number(r.person_days ?? 0);
  }
  return result;
}

// Round 4b — fetch GL census applicability for the GLs in scope. Returns a
// deterministic per-GL lookup of { classification, applicableTypes }. Used
// when groupBy === 'gl' OR filterStack pins a GL — to narrow each row's PPD
// denominator to only the applicable census types per the BVS Reporting
// Contract extension for GL applicability (Path B math-aware mode).
//
// Map.get(unknownId) === undefined is the fall-back signal — caller emits a
// structured warning that includes the GL id, code, and name for grep-based
// verification, then falls back to universal (full scope).
async function fetchGlApplicabilityMap(
  sql: any,
  glIds: string[],
): Promise<Map<string, { classification: "universal" | "partial"; applicableTypes: string[]; code: string; name: string }>> {
  const out = new Map<string, { classification: "universal" | "partial"; applicableTypes: string[]; code: string; name: string }>();
  if (glIds.length === 0) return out;
  const list = glIds.map(s => `'${s}'`).join(", ");
  const rows = await sql.unsafe(`
    SELECT g.id::text AS gl_id, g.code, g.name,
           g.census_classification AS classification,
           COALESCE(
             ARRAY_AGG(t.census_type ORDER BY t.census_type) FILTER (WHERE t.census_type IS NOT NULL),
             '{}'::text[]
           ) AS applicable_types
    FROM bvs.gl_accounts g
    LEFT JOIN bvs.gl_applicable_census_types t ON t.gl_account_id = g.id
    WHERE g.id IN (${list})
    GROUP BY g.id, g.code, g.name, g.census_classification
  `);
  for (const r of rows) {
    const classification = String(r.classification ?? "") as "universal" | "partial";
    const applicableTypes: string[] = Array.isArray(r.applicable_types)
      ? r.applicable_types.map((t: any) => String(t))
      : [];
    out.set(String(r.gl_id), {
      classification,
      applicableTypes,
      code: String(r.code ?? ""),
      name: String(r.name ?? ""),
    });
  }
  return out;
}

async function shimEngineToLegacy(
  sql: any,
  result: any,
  request: {
    path: string[];
    filterStack: Array<{ column: string; values: string[] }>;
    timeframe: { start: string; end: string };
  },
): Promise<void> {
  if (!result?.view?.kpi || !Array.isArray(result?.rows)) return;

  const path = request.path;
  const perspective = path[0];
  const groupBy = path[path.length - 1];
  const viewId = result.view.id;

  // Phase 4b QA — resolve filtered entity_ids to display labels.
  const entityLabels = await resolveFilterEntityLabels(sql, request.filterStack);

  // ---- View labels (fix #1 "Facilitys", part of fix #2) -------------------
  // scopeLabel:
  //   - At root (path.length === 1): pluralized perspective name (e.g. "Facilities")
  //   - At drill: "{groupBy plural} within {parent entity label}"
  //     (mirrors legacy `GL Accounts within ${facName}` convention)
  // entityTypeLabel: pluralized groupBy (e.g. "GL Accounts"), used for
  //   column header.
  const groupByLabel = ENTITY_TYPE_LABEL[groupBy] ?? groupBy;
  const groupByPlural = pluralizeLabel(groupByLabel);
  const perspectivePlural = pluralizeLabel(ENTITY_TYPE_LABEL[perspective] ?? perspective);

  if (path.length === 1) {
    result.view.scopeLabel = perspectivePlural;
    result.view.entityTypeLabel = perspectivePlural;
  } else {
    const parentDim = path[path.length - 2];
    const parentCol = DIM_TO_FILTER_COL[parentDim];
    const parentLabel = entityLabels[parentCol]
      ?? ENTITY_TYPE_LABEL[parentDim]
      ?? parentDim;
    result.view.scopeLabel = `${groupByPlural} within ${parentLabel}`;
    result.view.entityTypeLabel = groupByPlural;
  }

  // ---- Breadcrumbs (fix #2) -----------------------------------------------
  // Engine's buildBreadcrumbs emitted dimension type names ("GL Accounts" for
  // the root crumb when drilled, "GL Account" for current). Rewrite using:
  //   - Crumb 0: pluralized perspective name (e.g. "Facilities")
  //   - Crumb i (i > 0): entity name of filter applied at path[i-1]
  //     (e.g. "SNF - Kingswood Skilled Nursing - Lansing")
  if (Array.isArray(result.breadcrumbs)) {
    for (let i = 0; i < result.breadcrumbs.length; i++) {
      const crumb = result.breadcrumbs[i];
      if (i === 0) {
        crumb.label = perspectivePlural;
      } else {
        const filterDim = path[i - 1];
        const filterCol = DIM_TO_FILTER_COL[filterDim];
        crumb.label = entityLabels[filterCol]
          ?? ENTITY_TYPE_LABEL[filterDim]
          ?? filterDim;
      }
    }
  }

  // ---- KPI ----------------------------------------------------------------
  const kpi = result.view.kpi;
  const included = result.rows.filter((r: any) => !r.excluded);
  const excluded = result.rows.filter((r: any) => r.excluded);
  kpi.percent = kpi.variancePercent;
  // KPI is "excluded" only when variancePercent is null (no budget). Otherwise
  // apply normal thresholds. Excluded flag on a KPI is not meaningful (it's
  // a row-level concept), so we pass excluded=false.
  kpi.status = classifyStatusForShim(kpi.percent, false);
  kpi.reconciliation = {
    kpiId: `bvs-kpi-${viewId}`,
    rowCount: result.rows.length,
    includedRows: included.length,
    excludedRows: excluded.length,
    checksum: `bvs-${result.rows.length}-${kpi.budget}`,
  };
  if (!kpi.id) kpi.id = `bvs-kpi-${viewId}`;
  if (!kpi.viewId) kpi.viewId = viewId;

  // ---- Rows ----------------------------------------------------------------
  if (groupBy === "txn") {
    // Engine txn shape: { id, txnDate, amount, committed, excluded,
    //                     glExcluded, reference, poNumber, invoiceNumber, txnType }
    // Legacy txn shape used by transform.tsx.
    result.rows = result.rows.map((r: any) => ({
      id: r.id,
      viewId,
      entityType: "Transaction",
      entityId: r.id,
      label: r.reference || `TXN-${r.id}`,
      budget: null,
      spend: Number(r.amount ?? 0),
      committed: Number(r.committed ?? 0),
      variance: null,
      variancePercent: null,
      status: "on_track",
      excluded: Boolean(r.excluded || r.glExcluded),
      childViewId: null,
      po: r.poNumber ?? null,
      invoice: r.invoiceNumber ?? null,
      txnType: r.txnType ?? null,
      lastTxnDate: r.txnDate ?? null,
      // Preserve original engine fields for any downstream that wants them.
      txnDate: r.txnDate ?? null,
      amount: r.amount,
      reference: r.reference,
      poNumber: r.poNumber,
      invoiceNumber: r.invoiceNumber,
      glExcluded: Boolean(r.glExcluded),
    }));
  } else {
    // Non-txn: alias fields, derive childViewId, capitalize entityType.
    for (const row of result.rows) {
      const engineEntityId = String(row.id);
      row.entityId = engineEntityId;
      row.spend = row.consumed;
      row.entityType = ENTITY_TYPE_LABEL[row.entityType] ?? row.entityType;
      row.status = classifyStatusForShim(row.variancePercent, Boolean(row.excluded));
      row.childViewId = buildChildViewIdForShim(
        path,
        request.filterStack,
        engineEntityId,
        groupBy,
      );
      if (row.po === undefined) row.po = null;
      if (row.invoice === undefined) row.invoice = null;
      if (row.txnType === undefined) row.txnType = null;
      row.viewId = viewId;
    }
    // Phase 4b QA fix #5 — stable-sort: excluded rows always at the bottom.
    // Engine returns rows in SQL natural order (excluded interleaved); the UI
    // renders an "EXCLUDED ITEMS" section header whenever it encounters a run
    // of excluded rows. Without this sort, drilled views show multiple
    // "EXCLUDED ITEMS" headers throughout the table. JS Array.sort is stable
    // in modern engines, so within each group the engine's row order is
    // preserved.
    result.rows.sort((a: any, b: any) => (a.excluded ? 1 : 0) - (b.excluded ? 1 : 0));

    // Round 2 — attach per-type person-days for the Census column. Mirrors
    // the engine's attachPPDFromPlan facilityIds resolution so each row gets
    // the right scope:
    //   - groupBy=facility (fac-root, gl.facility, vendor.facility): each row
    //     gets its own facility's per-type breakdown.
    //   - facility filter present (facility.gl, facility.gl.vendor): all rows
    //     inherit the parent facility's per-type breakdown.
    //   - portfolio-shared (gl-root, vendor-root) and subset-scoped views: all
    //     rows share the aggregated per-type breakdown across queried
    //     facilities. (For portfolio-shared, that's the whole portfolio.)
    // censusValue mirrors personDays (= cumulative PD for the timeframe) per
    // the agreed display convention ("sum of days in a range is the person
    // days that we'll call census"). personDaysByType is the new field the
    // client column reads to render multi-type CCRC breakdowns.
    const facilityFilter = request.filterStack.find(f => f.column === "facility_id");
    let pdScopeIds: string[] | null = null;
    if (facilityFilter) {
      pdScopeIds = facilityFilter.values;
    } else if (groupBy === "facility") {
      pdScopeIds = result.rows.map((r: any) => String(r.entityId ?? r.id));
    }
    // pdScopeIds === null → portfolio scope (gl-root, vendor-root, etc.)

    const pdByType = await fetchPersonDaysByType(
      sql,
      request.timeframe.start,
      request.timeframe.end,
      pdScopeIds,
    );

    // Aggregate across all queried facilities (used for shared-scope rows and
    // for the KPI personDaysByType).
    const aggregateByType: Record<string, number> = {};
    for (const fid of Object.keys(pdByType)) {
      for (const [ctype, pd] of Object.entries(pdByType[fid])) {
        aggregateByType[ctype] = (aggregateByType[ctype] ?? 0) + pd;
      }
    }
    const aggregateTotal = Object.values(aggregateByType).reduce(
      (a, b) => a + b,
      0,
    );

    if (groupBy === "facility") {
      // Each row IS a facility — use its own breakdown.
      for (const row of result.rows) {
        const fid = String(row.entityId ?? row.id);
        const byType = pdByType[fid] ?? {};
        const total = Object.values(byType).reduce((a, b) => a + b, 0);
        row.personDaysByType = byType;
        row.personDays = total;
        row.censusValue = total;
        row.censusBasis = "ACTUAL";
      }
    } else if (facilityFilter && facilityFilter.values.length === 1) {
      // Single-facility drill — every row inherits the parent's breakdown.
      const fid = facilityFilter.values[0];
      const byType = pdByType[fid] ?? {};
      const total = Object.values(byType).reduce((a, b) => a + b, 0);
      for (const row of result.rows) {
        row.personDaysByType = byType;
        row.personDays = total;
        row.censusValue = total;
        row.censusBasis = "ACTUAL";
      }
    } else {
      // Portfolio-shared or subset-scoped — every row shares the aggregate.
      for (const row of result.rows) {
        row.personDaysByType = aggregateByType;
        row.personDays = aggregateTotal;
        row.censusValue = aggregateTotal;
        row.censusBasis = "ACTUAL";
      }
    }

    // KPI gets the aggregate (sum across queried facilities). For
    // facility-scoped drills this equals the parent facility's breakdown;
    // for portfolio views it equals the portfolio breakdown.
    result.view.kpi.personDaysByType = aggregateByType;

    // Round 4b — Math-aware GL applicability (Path B per BVS Reporting
    // Contract extension). When a GL is in scope (groupBy === 'gl' OR
    // filterStack pins a gl_account_id), narrow each row's PPD denominator
    // to only the census types applicable to that row's GL, then re-attach
    // PPD with the new denominator.
    //
    // KPI math is UNCHANGED — KPI uses the full facility/timeframe scope
    // denominator per directive. Row-level reconciliation is intentionally
    // not expected to equal KPI in this mode; aggregate vs row PPD answer
    // different questions and the annotation copy explains the distinction.
    //
    // Contract emitted per non-txn row:
    //   _applicableCensusTypes   — list ['AL','SNF',...] (always ≥1 type per
    //                              Round 4d governance: every GL has applicable
    //                              types) or null when no GL is in scope
    //   _personDays              — final denominator used (applicable sum, or
    //                              full sum for full_scope rows, or full sum
    //                              for fallback rows when applicable ∩ facility = ∅)
    //   _personDaysByType        — full scoped breakdown (NOT filtered — UI
    //                              derives filtered view at render time)
    //   _nonApplicablePersonDays — sum of types excluded by applicability,
    //                              0 for universal/full_scope/fallback
    //   _ppdCalculationBasis     — 'gl_applicability' | 'gl_applicability_fallback' | 'full_scope'
    //                              fallback occurs when applicable ∩ facility = ∅
    //                              but the facility has census; per Round 4f
    //                              "no null person days" rule
    const glFilter = request.filterStack.find(f => f.column === "gl_account_id");
    const isGlInScope = groupBy === "gl" || !!glFilter;

    if (isGlInScope) {
      // Collect all GL IDs needed for applicability lookup.
      const glIds = new Set<string>();
      if (glFilter) {
        for (const v of glFilter.values) glIds.add(String(v));
      }
      if (groupBy === "gl") {
        for (const row of result.rows) {
          const id = row.entityId ?? row.id;
          if (id) glIds.add(String(id));
        }
      }

      const applicabilityMap = await fetchGlApplicabilityMap(sql, Array.from(glIds));

      for (const row of result.rows) {
        // Determine this row's GL identity. For groupBy=gl, the row IS the
        // GL. For groupBy=facility/vendor with a gl filter, all rows share
        // the filter's GL identity.
        const glId =
          groupBy === "gl"
            ? String(row.entityId ?? row.id)
            : String(glFilter!.values[0]);

        const apply = applicabilityMap.get(glId);
        const byType = (row.personDaysByType ?? {}) as Record<string, number>;
        const fullSum = Object.values(byType).reduce((a, b) => a + Number(b), 0);

        if (!apply) {
          // Missing applicability mapping — fall back to universal/full-scope
          // with structured warning. seed coverage should be 100%, so this
          // only fires if a new GL is added without curation.
          console.warn(
            `[bvs.applicability.missing] gl_id=${glId} — no row in bvs.gl_accounts.census_classification; falling back to full_scope. Add a classification row to fix.`
          );
          row._applicableCensusTypes = null;
          row._nonApplicablePersonDays = 0;
          row._ppdCalculationBasis = "full_scope";
          // personDays + PPD unchanged from v70 logic above.
          continue;
        }

        // universal or partial — narrow denominator to applicable types.
        // Round 4d governance correction removed the "overhead" classification:
        // every GL must have ≥1 applicable type, so this branch handles all GLs.
        // Exclusion (not applicability) is the mechanism for "no PPD math".
        const applicableTypes = apply.applicableTypes;
        const applicableSum = applicableTypes.reduce(
          (sum, t) => sum + (Number(byType[t]) || 0),
          0,
        );

        if (applicableSum > 0) {
          // Normal case: applicable types ∩ facility types ≠ ∅.
          const nonApplicable = fullSum - applicableSum;
          row._applicableCensusTypes = applicableTypes;
          row._nonApplicablePersonDays = nonApplicable;
          row._ppdCalculationBasis = "gl_applicability";
          row.personDays = applicableSum;
          row.censusValue = applicableSum;
          attachRowPPD(row, applicableSum);
        } else if (fullSum > 0) {
          // Round 4f fallback: applicable types ∩ facility types = ∅ (e.g.,
          // AL+SNF partial GL at IL-only facility). Per directive "Ensure
          // there are no null person days anywhere": fall back to the
          // facility's available census as the denominator. The GL's
          // applicability metadata is preserved (so the row contract still
          // tells consumers what the GL is *meant* to apply to), but the
          // math uses what's actually present at this facility.
          row._applicableCensusTypes = applicableTypes;
          row._nonApplicablePersonDays = 0;
          row._ppdCalculationBasis = "gl_applicability_fallback";
          row.personDays = fullSum;
          row.censusValue = fullSum;
          attachRowPPD(row, fullSum);
        } else {
          // Edge case: facility has zero PD across all census types for the
          // selected timeframe. Truly no census available — this is the
          // "null error" case (David: "Only when no census is available
          // should a GL have a null error"). Should not occur in practice
          // for the seeded data. Defensive: emit warning, leave row null.
          console.warn(
            `[bvs.applicability.no_census] facility has zero PD across all census types for timeframe — leaving row with null PPD`,
          );
          row._applicableCensusTypes = applicableTypes;
          row._nonApplicablePersonDays = 0;
          row._ppdCalculationBasis = "gl_applicability";
          row.personDays = 0;
          row.censusValue = 0;
          attachRowPPD(row, 0);
        }
      }
    } else {
      // No GL in scope — every row uses the full facility/timeframe scope
      // denominator already set by v70 logic above. Just mark the basis so
      // the client can render consistent annotations.
      for (const row of result.rows) {
        row._applicableCensusTypes = null;
        row._nonApplicablePersonDays = 0;
        row._ppdCalculationBasis = "full_scope";
        // personDays / personDaysByType / PPD unchanged.
      }
    }
  }
}

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-BVS-Response-Shape", "X-BVS-Engine"],
    maxAge: 600,
  }),
);

// Health check endpoint — Ship 1: async, returns anchorYear instead of manual deploy stamp
app.get("/make-server-b98afb97/health", async (c) => {
  try {
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    return c.json({ status: "ok", ts: Date.now(), anchorYear });
  } catch (err: any) {
    return c.json({ status: "degraded", ts: Date.now(), error: err?.message ?? String(err) }, 200);
  }
});

// ---------------------------------------------------------------------------
// Report Data API — KV-backed storage for report views
// ---------------------------------------------------------------------------

// Seed all report view data into KV store
// Expects: { views: Record<string, any>, facilityNames: string[], censusDisplays: Record<string, any> }
app.post("/make-server-b98afb97/report/seed", async (c) => {
  try {
    const body = await c.req.json();
    const { views, facilityNames, censusDisplays } = body;

    if (!views || typeof views !== "object") {
      return c.json({ error: "Missing or invalid 'views' in request body" }, 400);
    }

    // Store each view under its own key
    const viewKeys: string[] = [];
    const viewValues: any[] = [];
    for (const [viewId, viewData] of Object.entries(views)) {
      viewKeys.push(`report:view:${viewId}`);
      viewValues.push(viewData);
    }

    // Store facility names
    viewKeys.push("report:facilityNames");
    viewValues.push(facilityNames ?? []);

    // Store census display map
    if (censusDisplays && typeof censusDisplays === "object") {
      viewKeys.push("report:censusDisplays");
      viewValues.push(censusDisplays);
    }

    // Store view index for listing
    viewKeys.push("report:viewIndex");
    viewValues.push(Object.keys(views));

    // Store all views as a single bundle for bulk retrieval
    viewKeys.push("report:allViews");
    viewValues.push(views);

    // Store version marker
    viewKeys.push("report:version");
    viewValues.push("v8-excluded-spend-separation");

    // Batch write
    await kv.mset(viewKeys, viewValues);

    console.log(`Seeded ${Object.keys(views).length} report views into KV store`);
    return c.json({ status: "ok", viewCount: Object.keys(views).length });
  } catch (err: any) {
    console.log(`Error seeding report data: ${err?.message ?? err}`);
    return c.json({ error: `Seed error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get all report views at once
app.get("/make-server-b98afb97/report/views/all", async (c) => {
  try {
    const allViews = await kv.get("report:allViews");
    if (!allViews || typeof allViews !== "object") {
      return c.json({ error: "No views found" }, 404);
    }
    return c.json(allViews);
  } catch (err: any) {
    console.log(`Error retrieving all views: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get a single report view by ID
app.get("/make-server-b98afb97/report/view/:viewId", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const viewData = await kv.get(`report:view:${viewId}`);

    if (!viewData) {
      return c.json({ error: `View not found: ${viewId}` }, 404);
    }

    return c.json(viewData);
  } catch (err: any) {
    console.log(`Error retrieving view: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get facility names
app.get("/make-server-b98afb97/report/facility-names", async (c) => {
  try {
    const names = await kv.get("report:facilityNames");
    return c.json(names ?? []);
  } catch (err: any) {
    console.log(`Error retrieving facility names: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Get census display map
app.get("/make-server-b98afb97/report/census-displays", async (c) => {
  try {
    const displays = await kv.get("report:censusDisplays");
    return c.json(displays ?? {});
  } catch (err: any) {
    console.log(`Error retrieving census displays: ${err?.message ?? err}`);
    return c.json({ error: `Retrieval error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// Check if seed data exists
app.get("/make-server-b98afb97/report/seed-status", async (c) => {
  try {
    const viewIndex = await kv.get("report:viewIndex");
    const version = await kv.get("report:version");
    return c.json({ seeded: !!viewIndex, viewCount: viewIndex?.length ?? 0, version: version ?? null });
  } catch (err: any) {
    console.log(`Error checking seed status: ${err?.message ?? err}`);
    return c.json({ error: `Status check error: ${err?.message ?? "unknown"}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// BVS Schema — Direct Postgres connection via Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getBvsClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: "bvs" },
  });
}

// Connection verification — runs the spec's verification query
app.get("/make-server-b98afb97/bvs/verify", async (c) => {
  try {
    const bvs = getBvsClient();

    // Run verification via RPC or raw query. Supabase JS doesn't support
    // cross-schema joins natively, so we use the rpc approach with a
    // direct SQL call through the REST API. We'll query each table
    // individually first to prove connectivity, then attempt the join.

    // Step 1: Verify table access — count each table
    const [facilities, glAccounts, vendors, transactions, budgets, exclusions] =
      await Promise.all([
        bvs.from("facilities").select("id", { count: "exact", head: true }),
        bvs.from("gl_accounts").select("id", { count: "exact", head: true }),
        bvs.from("vendors").select("id", { count: "exact", head: true }),
        bvs.from("transactions").select("id", { count: "exact", head: true }),
        bvs.from("budgets_daily").select("id", { count: "exact", head: true }),
        bvs.from("exclusions").select("id", { count: "exact", head: true }),
      ]);

    const tableCounts = {
      facilities: { count: facilities.count, error: facilities.error?.message ?? null },
      gl_accounts: { count: glAccounts.count, error: glAccounts.error?.message ?? null },
      vendors: { count: vendors.count, error: vendors.error?.message ?? null },
      transactions: { count: transactions.count, error: transactions.error?.message ?? null },
      budgets_daily: { count: budgets.count, error: budgets.error?.message ?? null },
      exclusions: { count: exclusions.count, error: exclusions.error?.message ?? null },
    };

    const allTablesOk = Object.values(tableCounts).every(
      (t) => t.error === null && t.count !== null
    );

    // Step 2: Run the verification join query via Postgres function
    // We'll use supabase.rpc if a function exists, otherwise we fall back
    // to constructing the join client-side using fetched data.
    // Since Supabase JS can't do cross-table joins in bvs schema directly,
    // we'll use the DB URL with the postgres driver.
    let joinResult: { total_spend: number | null; total_budget: number | null } | null = null;
    let joinError: string | null = null;

    try {
      const dbUrl = Deno.env.get("SUPABASE_DB_URL");
      if (dbUrl) {
        const { default: postgres } = await import("npm:postgres@3.4.4");
        const sql = postgres(dbUrl, { ssl: "prefer" });

        const [yrRow] = await sql`
          SELECT DATE_PART('year', MAX(txn_date))::int AS yr
          FROM bvs.transactions
        `;
        const verifyYear = Number(yrRow?.yr) && Number(yrRow.yr) >= 2000 && Number(yrRow.yr) <= 2100
          ? Number(yrRow.yr)
          : new Date().getUTCFullYear();

        const rows = await sql`
          SELECT
            SUM(t.amount_actual + t.amount_committed) AS total_spend,
            SUM(b.amount) AS total_budget
          FROM bvs.transactions t
          JOIN bvs.budgets_daily b
            ON b.facility_id = t.facility_id
            AND b.gl_account_id = t.gl_account_id
            AND DATE_TRUNC('month', t.txn_date) = b.effective_date
          JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
          WHERE t.excluded = false

            AND g.excluded = false
            AND t.txn_date >= '${verifyYear}-01-01'::date
            AND t.txn_date < '${verifyYear + 1}-01-01'::date
        `;

        if (rows.length > 0) {
          joinResult = {
            total_spend: rows[0].total_spend !== null ? Number(rows[0].total_spend) : null,
            total_budget: rows[0].total_budget !== null ? Number(rows[0].total_budget) : null,
          };
        }

        await sql.end();
      } else {
        joinError = "SUPABASE_DB_URL not configured";
      }
    } catch (err: any) {
      joinError = `Join query error: ${err?.message ?? err}`;
      console.log(`BVS join verification error: ${joinError}`);
    }

    const connectionLive =
      allTablesOk &&
      joinResult !== null &&
      joinResult.total_spend !== null &&
      joinResult.total_budget !== null;

    return c.json({
      status: connectionLive ? "VERIFIED" : "PARTIAL",
      connectionLive,
      tableCounts,
      verificationQuery: {
        result: joinResult,
        error: joinError,
        pass:
          joinResult !== null &&
          joinResult.total_spend !== null &&
          joinResult.total_budget !== null,
      },
    });
  } catch (err: any) {
    console.log(`BVS verify error: ${err?.message ?? err}`);
    return c.json(
      { status: "ERROR", error: `BVS verify failed: ${err?.message ?? err}` },
      500
    );
  }
});

// Fetch table metadata (column names, sample row) for any bvs table
app.get("/make-server-b98afb97/bvs/table/:tableName", async (c) => {
  try {
    const tableName = c.req.param("tableName");
    const allowed = ["facilities", "gl_accounts", "vendors", "transactions", "budgets_daily", "exclusions"];
    if (!allowed.includes(tableName)) {
      return c.json({ error: `Table not allowed: ${tableName}` }, 400);
    }

    const bvs = getBvsClient();
    const { data, error, count } = await bvs
      .from(tableName)
      .select("*", { count: "exact" })
      .limit(5);

    if (error) {
      return c.json({ error: `Query error on ${tableName}: ${error.message}` }, 500);
    }

    return c.json({
      table: tableName,
      totalRows: count,
      sampleRows: data,
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
    });
  } catch (err: any) {
    console.log(`BVS table inspect error: ${err?.message ?? err}`);
    return c.json({ error: `Table inspect failed: ${err?.message ?? err}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// BVS Live Report Views — dynamically aggregated from bvs.* tables
// ---------------------------------------------------------------------------

let _sqlPool: any = null;
let _sqlPoolCreatedAt = 0;
const SQL_POOL_MAX_AGE = 60000; // recreate pool after 60s to avoid stale connections

async function getBvsSql() {
  const now = Date.now();
  if (_sqlPool) {
    // Recreate if pool is too old
    if (now - _sqlPoolCreatedAt > SQL_POOL_MAX_AGE) {
      console.log("BVS SQL pool expired, reconnecting...");
      try { await _sqlPool.end(); } catch { /* ignore */ }
      _sqlPool = null;
    } else {
      // Verify the pool is still alive with a lightweight check
      try {
        await _sqlPool`SELECT 1`;
        return _sqlPool;
      } catch {
        console.log("BVS SQL pool stale, reconnecting...");
        try { await _sqlPool.end(); } catch { /* ignore */ }
        _sqlPool = null;
      }
    }
  }
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not configured");
  const { default: postgres } = await import("npm:postgres@3.4.4");
  _sqlPool = postgres(dbUrl, { ssl: "prefer", max: 5, idle_timeout: 30, connect_timeout: 30 });
  _sqlPoolCreatedAt = now;
  return _sqlPool;
}

// ---------------------------------------------------------------------------
// Anchor-year resolver — Ship 1 of the BVS roadmap.
// Replaces the literal year=2025 default with MAX(txn_date)'s year.
// Cached for 60s so high-traffic periods don't thrash the transactions table.
// Bound: at year rollover, new-year data is visible within 60s of the first
// new-year transaction.
// ---------------------------------------------------------------------------
let _anchorYearCache: { year: number; fetchedAt: number } | null = null;
const ANCHOR_YEAR_CACHE_MS = 60_000;

async function getAnchorYear(sql: any): Promise<number> {
  const now = Date.now();
  if (_anchorYearCache && now - _anchorYearCache.fetchedAt < ANCHOR_YEAR_CACHE_MS) {
    return _anchorYearCache.year;
  }
  try {
    const [row] = await sql`
      SELECT DATE_PART('year', MAX(txn_date))::int AS yr
      FROM bvs.transactions
    `;
    const year = Number(row?.yr);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      console.log(`BVS anchor-year: unexpected MAX(txn_date) year=${row?.yr}; falling back to current UTC year`);
      _anchorYearCache = { year: new Date().getUTCFullYear(), fetchedAt: now };
    } else {
      _anchorYearCache = { year, fetchedAt: now };
    }
  } catch (err: any) {
    console.log(`BVS anchor-year lookup failed: ${err?.message ?? err}; falling back to current UTC year`);
    _anchorYearCache = { year: new Date().getUTCFullYear(), fetchedAt: now };
  }
  return _anchorYearCache.year;
}

// Generic view resolver — parses the viewId to determine which query to run
app.get("/make-server-b98afb97/bvs/report/view/:viewId", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const sm = (c.req.query("spendMode") ?? "totalImpact") as SpendMode;
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);

    // Ship 4a: resolve (startDate, endDate) from explicit start/end params,
    // falling back to yearParam, then to anchorYear.
    const { startDate, endDate, isEnriched } = resolveDateRange(
      c.req.query("start"),
      c.req.query("end"),
      c.req.query("year"),
      anchorYear,
    );

    let result: any = null;

    // Parse viewId to determine the correct query
    if (viewId === "bvs-fac-root") {
      result = await buildFacilityRoot(sql, startDate, endDate, sm);
    } else if (viewId === "bvs-gl-root") {
      result = await buildGlRoot(sql, startDate, endDate, sm);
    } else if (viewId === "bvs-vendor-root") {
      result = await buildVendorRoot(sql, startDate, endDate, sm);
    } else if (viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor-(.+)-txn$/)) {
      const m = viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor-(.+)-txn$/)!;
      result = await buildFacilityGlVendorTxnDrill(sql, startDate, endDate, m[1], m[2], m[3], sm);
    } else if (viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor$/)) {
      const m = viewId.match(/^bvs-fac-(.+)-gl-(.+)-vendor$/)!;
      result = await buildFacilityGlVendorDrill(sql, startDate, endDate, m[1], m[2], sm);
    } else if (viewId.match(/^bvs-fac-(.+)-gl$/)) {
      const m = viewId.match(/^bvs-fac-(.+)-gl$/)!;
      result = await buildFacilityGlDrill(sql, startDate, endDate, m[1], sm);
    } else if (viewId.match(/^bvs-gl-(.+)-vendor-(.+)-txn$/)) {
      const m = viewId.match(/^bvs-gl-(.+)-vendor-(.+)-txn$/)!;
      result = await buildGlVendorTxnDrill(sql, startDate, endDate, m[1], m[2], sm);
    } else if (viewId.match(/^bvs-gl-(.+)-vendor$/)) {
      const m = viewId.match(/^bvs-gl-(.+)-vendor$/)!;
      result = await buildGlVendorDrill(sql, startDate, endDate, m[1], sm);
    } else if (viewId.match(/^bvs-vendor-(.+)-fac-(.+)-txn$/)) {
      const m = viewId.match(/^bvs-vendor-(.+)-fac-(.+)-txn$/)!;
      result = await buildVendorFacTxnDrill(sql, startDate, endDate, m[1], m[2], sm);
    } else if (viewId.match(/^bvs-vendor-(.+)-fac$/)) {
      const m = viewId.match(/^bvs-vendor-(.+)-fac$/)!;
      result = await buildVendorFacDrill(sql, startDate, endDate, m[1], sm);
    }

    if (!result) {
      console.log(`BVS view resolver: viewId=${viewId} resolved to null (entity not found or unrecognized pattern)`);
      return c.json({ error: `View resolved to null — entity not found for viewId: ${viewId}` }, 404);
    }

    // Ship 4a: legacy path gets the pre-4a shape (PPD stripped, no version
    // header). Enriched path retains PPD and stamps the response-shape header.
    if (isEnriched) {
      c.header("X-BVS-Response-Shape", "v2");
    } else {
      stripEnrichedFields(result);
    }

    return c.json(result);
  } catch (err: any) {
    console.log(`BVS report view error for viewId=${c.req.param("viewId")}: ${err?.message ?? err}`);
    console.log(`BVS stack: ${err?.stack ?? "no stack"}`);
    return c.json({ error: `BVS view error: ${err?.message ?? err}`, viewId: c.req.param("viewId") }, 500);
  }
});

// Preload root views for all three pivots
app.get("/make-server-b98afb97/bvs/report/roots", async (c) => {
  try {
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    const { startDate, endDate, isEnriched } = resolveDateRange(
      c.req.query("start"),
      c.req.query("end"),
      c.req.query("year"),
      anchorYear,
    );
    const sm = (c.req.query("spendMode") ?? "totalImpact") as SpendMode;
    console.log(`BVS roots: building ${startDate}..${endDate} (enriched=${isEnriched})`);
    console.log(`BVS roots: sql pool acquired`);

    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // Build each root independently to isolate failures
    for (const [key, builder] of [
      ["bvs-fac-root", () => buildFacilityRoot(sql, startDate, endDate, sm)],
      ["bvs-gl-root", () => buildGlRoot(sql, startDate, endDate, sm)],
      ["bvs-vendor-root", () => buildVendorRoot(sql, startDate, endDate, sm)],
    ] as [string, () => Promise<any>][]) {
      try {
        console.log(`BVS roots: building ${key}...`);
        results[key] = await builder();
        console.log(`BVS roots: ${key} built with ${results[key]?.rows?.length ?? 0} rows`);
      } catch (err: any) {
        errors[key] = err?.message ?? String(err);
        console.log(`BVS roots: ${key} FAILED: ${errors[key]}`);
      }
    }

    if (Object.keys(results).length === 0) {
      return c.json({ error: `All root views failed`, errors }, 500);
    }

    // Ship 4a: strip/stamp based on enriched mode.
    if (isEnriched) {
      c.header("X-BVS-Response-Shape", "v2");
    } else {
      for (const viewResult of Object.values(results)) stripEnrichedFields(viewResult);
    }

    return c.json(results);
  } catch (err: any) {
    console.log(`BVS roots error: ${err?.message ?? err}`);
    return c.json({ error: `BVS roots error: ${err?.message ?? err}` }, 500);
  }
});

// BVS facility names
app.get("/make-server-b98afb97/bvs/report/facility-names", async (c) => {
  try {
    const sql = await getBvsSql();
    const names = await bvsGetFacilityNames(sql);
    return c.json(names);
  } catch (err: any) {
    console.log(`BVS facility names error: ${err?.message ?? err}`);
    return c.json({ error: `BVS facility names error: ${err?.message ?? err}` }, 500);
  }
});

// BVS anchor date — MAX(txn_date) from active transactions
app.get("/make-server-b98afb97/bvs/report/anchor-date", async (c) => {
  try {
    const sql = await getBvsSql();
    const [row] = await sql`SELECT MAX(txn_date) AS max_date FROM bvs.transactions`;
    let maxDate: string | null = null;
    if (row?.max_date) {
      const d = row.max_date;
      // Handle both Date objects and string representations
      if (d instanceof Date) {
        maxDate = d.toISOString().slice(0, 10);
      } else {
        // Try to parse as string — could be ISO or other format
        const parsed = new Date(String(d));
        if (!isNaN(parsed.getTime())) {
          maxDate = parsed.toISOString().slice(0, 10);
        } else {
          maxDate = String(d).slice(0, 10);
        }
      }
    }
    console.log(`BVS anchor date: ${maxDate}`);
    return c.json({ anchorDate: maxDate });
  } catch (err: any) {
    console.log(`BVS anchor date error: ${err?.message ?? err}`);
    return c.json({ error: `Anchor date error: ${err?.message ?? err}` }, 500);
  }
});

// BVS period breakdown — per-period (monthly/quarterly) spend/budget per entity
app.get("/make-server-b98afb97/bvs/report/view/:viewId/periods", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const viewBy = c.req.query("viewBy") ?? "monthly";
    const sm = (c.req.query("spendMode") ?? "totalImpact") as SpendMode;

    if (viewBy !== "monthly" && viewBy !== "quarterly") {
      return c.json({ error: `Invalid viewBy: ${viewBy}. Must be 'monthly' or 'quarterly'.` }, 400);
    }

    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    const { startDate, endDate, isEnriched } = resolveDateRange(
      c.req.query("start"),
      c.req.query("end"),
      c.req.query("year"),
      anchorYear,
    );

    console.log(`BVS periods: viewId=${viewId}, viewBy=${viewBy}, range=${startDate}..${endDate}, spendMode=${sm}, enriched=${isEnriched}`);
    // Ship 4c: when isEnriched, period buckets carry server-computed PPD via
    // the V3 doctrine denominator. Legacy callers (no start/end) get the
    // pre-4c shape — no PPD fields, no v2 header.
    const periods = await buildPeriodBreakdown(sql, viewId, viewBy, startDate, endDate, sm, isEnriched);
    console.log(`BVS periods: ${Object.keys(periods).length} entities returned`);

    if (isEnriched) {
      c.header("X-BVS-Response-Shape", "v2");
    }
    return c.json({ viewId, viewBy, startDate, endDate, periods });
  } catch (err: any) {
    console.log(`BVS period breakdown error for viewId=${c.req.param("viewId")}: ${err?.message ?? err}`);
    return c.json({ error: `Period breakdown error: ${err?.message ?? err}` }, 500);
  }
});

// BVS sparkline data — trailing 12 months of monthly spend + budget per entity
app.get("/make-server-b98afb97/bvs/report/view/:viewId/sparklines", async (c) => {
  try {
    const viewId = c.req.param("viewId");
    const sql = await getBvsSql();
    const anchorYear = await getAnchorYear(sql);
    // Sparklines are always trailing-12-from-year. If caller passes start/end,
    // use end's year as the anchor year; otherwise anchorYear.
    const endParam = c.req.query("end");
    let year = anchorYear;
    if (endParam && /^\d{4}-\d{2}-\d{2}$/.test(endParam)) year = Number(endParam.slice(0, 4));
    else if (c.req.query("year")) year = Number(c.req.query("year"));

    console.log(`BVS sparklines: viewId=${viewId}, year=${year}`);
    const sparklines = await buildSparklineData(sql, viewId, year);
    console.log(`BVS sparklines: ${Object.keys(sparklines).length} entities returned`);

    return c.json({ viewId, year, sparklines });
  } catch (err: any) {
    console.log(`BVS sparkline error for viewId=${c.req.param("viewId")}: ${err?.message ?? err}`);
    return c.json({ error: `Sparkline error: ${err?.message ?? err}` }, 500);
  }
});

// BVS diagnostic — minimal test of query module
app.get("/make-server-b98afb97/bvs/report/diag", async (c) => {
  const steps: Record<string, any> = {};
  try {
    steps.dbUrlSet = !!Deno.env.get("SUPABASE_DB_URL");
    const sql = await getBvsSql();
    steps.sqlPoolOk = true;

    const facRows = await sql`SELECT COUNT(*) AS cnt FROM bvs.facilities`;
    steps.facilityCount = Number(facRows[0]?.cnt ?? 0);

    const year = await getAnchorYear(sql);
    steps.anchorYear = year;
    const { start, end } = yearRange(year);
    steps.diagRange = `${start}..${end}`;

    // Try building just the facility root
    const facRoot = await buildFacilityRoot(sql, start, end);
    steps.facRootRowCount = facRoot?.rows?.length ?? 0;
    steps.facRootViewId = facRoot?.view?.id ?? null;
    steps.facRootKpiBudget = facRoot?.view?.kpi?.budget ?? null;

    return c.json({ status: "OK", steps });
  } catch (err: any) {
    steps.error = err?.message ?? String(err);
    steps.stack = err?.stack ?? null;
    console.log(`BVS diag error: ${steps.error}`);
    return c.json({ status: "ERROR", steps }, 500);
  }
});

// ---------------------------------------------------------------------------
// Ship 5 Phase 2 — BVS Query Engine (Perspective-Based) endpoint
// ---------------------------------------------------------------------------
//
// Single endpoint serving all 12 valid drill paths via the planner +
// renderer + column resolver. Parallel to existing per-path endpoints
// (bvs/report/view/:viewId) — both serve the live UI through Phase 4
// (adapter migration). Phase 6 retires the per-path endpoints.
//
// Query params:
//   path        — dot-separated dimension chain (e.g. "facility.gl")
//   filter[col] — comma-separated value(s) (e.g. filter[facility_id]=X)
//   start, end  — ISO date strings
//   spendMode   — totalImpact | actual | commitment (default totalImpact)
//   debug       — "true" returns plan + SQL in response

app.get("/make-server-b98afb97/bvs/drill", async (c) => {
  try {
    const url = new URL(c.req.url);
    const sql = await getBvsSql();
    // Phase 4 fix: anchor-year fallback for preload-time calls when timeframe
    // hasn't yet been resolved client-side. Mirrors resolveDateRange behavior
    // of the legacy per-path endpoints so the engine accepts the same shape
    // during init (e.g. preloadRoots before user picks a timeframe).
    if (!url.searchParams.get("start") || !url.searchParams.get("end")) {
      const anchorYear = await getAnchorYear(sql);
      const { startDate, endDate } = resolveDateRange(
        url.searchParams.get("start") ?? undefined,
        url.searchParams.get("end") ?? undefined,
        url.searchParams.get("year") ?? undefined,
        anchorYear,
      );
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
    }
    const request = parseDrillRequest(url.searchParams);
    if (!request) {
      return c.json(
        { error: "Invalid drill request: requires 'path' param" },
        400,
      );
    }

    const result = await runDrillEngine(sql, request);

    // Phase 4b: shim engine response to legacy view shape for adapter compat.
    // Additive — original engine fields preserved alongside legacy-named twins.
    // Phase 4b QA — now async to resolve filter entity labels for breadcrumbs
    // and scope labels (DB lookup on dimension tables).
    await shimEngineToLegacy(sql, result, request);

    c.header("X-BVS-Response-Shape", "v2");
    c.header("X-BVS-Engine", "drill-engine-v1.0.0");
    return c.json(result);
  } catch (err: any) {
    const path = c.req.query("path") ?? "(none)";
    console.log(`BVS drill engine error for path=${path}: ${err?.message ?? err}`);
    console.log(`BVS drill stack: ${err?.stack ?? "no stack"}`);
    return c.json(
      { error: `Drill engine error: ${err?.message ?? err}`, path },
      500,
    );
  }
});

// Phase 4 — Engine periods route. Same path/filter[]/start/end/spendMode contract
// as /bvs/drill plus required `viewBy` (monthly | quarterly). Validates the
// drill path through the planner (Cross-Perspective Numerical Invariance), then
// delegates to buildPeriodBreakdown via engineToLegacyViewId translation.
// Supports all 12 valid drill paths including the 4 new Option B canonical
// orderings (G→F, G→F→V, V→G, V→G→F) for which legacy /periods has no equivalent.
app.get("/make-server-b98afb97/bvs/drill/periods", async (c) => {
  try {
    const url = new URL(c.req.url);
    const sql = await getBvsSql();
    // Phase 4 fix: anchor-year fallback (see /bvs/drill route comment).
    if (!url.searchParams.get("start") || !url.searchParams.get("end")) {
      const anchorYear = await getAnchorYear(sql);
      const { startDate, endDate } = resolveDateRange(
        url.searchParams.get("start") ?? undefined,
        url.searchParams.get("end") ?? undefined,
        url.searchParams.get("year") ?? undefined,
        anchorYear,
      );
      url.searchParams.set("start", startDate);
      url.searchParams.set("end", endDate);
    }
    const request = parseDrillPeriodsRequest(url.searchParams);
    if (!request) {
      return c.json(
        { error: "Invalid drill periods request: requires 'path', 'viewBy' (monthly|quarterly) params" },
        400,
      );
    }

    const result = await runDrillPeriodsEngine(sql, request);

    c.header("X-BVS-Response-Shape", "v2");
    c.header("X-BVS-Engine", "drill-engine-v1.0.0");
    return c.json(result);
  } catch (err: any) {
    const path = c.req.query("path") ?? "(none)";
    console.log(`BVS drill periods engine error for path=${path}: ${err?.message ?? err}`);
    console.log(`BVS drill periods stack: ${err?.stack ?? "no stack"}`);
    return c.json(
      { error: `Drill periods engine error: ${err?.message ?? err}`, path },
      500,
    );
  }
});

// ---------------------------------------------------------------------------

Deno.serve(app.fetch);