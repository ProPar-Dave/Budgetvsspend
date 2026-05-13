/**
 * BVS Query Engine (Perspective-Based) — Ship 5 Phase 1.2
 *
 * Logical Plan builder.
 *
 * Pure function. No I/O, no SQL, no external dependencies beyond
 * the dimension registry. Every drill query in BVS goes through
 * buildLogicalPlan to produce a deterministic Plan, which is then
 * consumed by the SQL renderer (Phase 1.3) and ultimately executed
 * by the engine endpoint.
 *
 * The Plan is the explanation surface — the debug endpoint returns
 * it verbatim. It is also the primary unit-test target: planner
 * outputs are compared structurally against fixtures derived from
 * the existing build's behavior (Phase 1.4 parity tests).
 *
 * Cross-references:
 *   - Ship 5 v3 spec §2.2 (SQL composer split into planner + renderer)
 *   - Ship 5 v3 spec §4 (Source-routing rule)
 *   - Ship 5 v3 spec §6 (PPD attachment rules)
 *   - Resolver doctrine: Cross-Perspective Numerical Invariance
 */

import {
  type DimensionId,
  type DimensionDef,
  type Filter,
  type Timeframe,
  type SpendMode,
  type RoutingStrategy,
  type PpdRule,
  type LogicalPlan,
  getDimension,
  getDimensionByFilterColumn,
  validateDrillPath,
} from "./bvs-drill-registry.tsx";

// ============================================================================
// Public entry point
// ============================================================================

export type BuildLogicalPlanInput = {
  /** Drill path. First element is the perspective root; last element
   *  is the groupBy. May be any length 1-4 per validateDrillPath. */
  path: DimensionId[];
  /** Filters applied. May be empty. Each filter's `column` must match
   *  the `filterColumn` of some dimension in `path`. */
  filterStack: Filter[];
  /** Inclusive date range for the query. */
  timeframe: Timeframe;
  /** Spend interpretation mode. */
  spendMode: SpendMode;
};

/**
 * Transform a drill request into a Logical Plan. The Plan is a pure
 * data structure — no execution, no side effects. Every decision the
 * renderer needs to make is encoded explicitly here.
 *
 * Throws on:
 *   - Invalid path (length, perspective root, txn placement, duplicates)
 *   - Filter columns that don't match any dimension in the path
 *   - Unknown dimension ids
 *
 * Does NOT throw on:
 *   - "hybrid" routing strategy. Planner CAN emit "hybrid" if a future
 *     dimension's source forces it; the RENDERER rejects hybrid in v1.
 *     Keeping the rejection in the renderer (not the planner) preserves
 *     the architectural readiness.
 */
export function buildLogicalPlan(input: BuildLogicalPlanInput): LogicalPlan {
  // 1. Validate path. Throws on invalid root, length, txn placement,
  //    duplicates, or unknown dimensions.
  validateDrillPath(input.path);

  // 2. Resolve every dimension referenced by the path.
  const dimensionsUsed: DimensionDef[] = input.path.map(getDimension);

  // 3. The groupBy is the last element of the path.
  const groupByDimId = input.path[input.path.length - 1];
  const groupByDim = getDimension(groupByDimId);

  // 4. Validate filterStack and resolve each filter to its registry
  //    dimension. Filters may reference any registered filterColumn —
  //    they don't need to be in the path. The path describes
  //    presentation; filters scope underlying data. They are
  //    independent concerns.
  const filterDims = resolveAndValidateFilterStack(input.filterStack);

  // 5. Decide routing strategy. MV vs raw transactions vs (future) hybrid.
  //    Considers BOTH path dimensions AND filter dimensions — a vendor
  //    filter on a facility-path query forces raw routing because the
  //    MV doesn't carry vendor.
  const routingStrategy = decideRoutingStrategy(dimensionsUsed, filterDims, groupByDim);

  // 6. Derive PPD rules. Row and KPI rules may differ — see registry
  //    docstring for the matrix.
  const { ppdRowRule, ppdKpiRule } = derivePpdRules(groupByDim, input.filterStack);

  // 7. Determine which fields the kernel will compute at execution.
  //    This is a declaration, not a guarantee — the engine actually
  //    populates `lineage.computation.computed` on each row at exec time.
  const computedFields = computeFieldList(routingStrategy, ppdRowRule);

  return {
    version: "1.0.0",
    path: input.path,
    groupBy: groupByDimId,
    filterStack: input.filterStack,
    timeframe: input.timeframe,
    spendMode: input.spendMode,
    routingStrategy,
    ppdRowRule,
    ppdKpiRule,
    dimensionsUsed,
    computedFields,
  };
}

// ============================================================================
// Filter validation + resolution
// ============================================================================

/**
 * Validate every filter in the stack against the dimension registry,
 * resolving each filter's column to its registry DimensionDef.
 *
 * Returns the array of resolved DimensionDefs (one per filter, in
 * filterStack order). The planner uses this both for routing decisions
 * and for downstream renderer hints.
 *
 * Throws on:
 *   - Unknown filter columns (no dimension's filterColumn matches)
 *   - Empty values arrays (filters with no values are nonsensical)
 */
function resolveAndValidateFilterStack(filterStack: Filter[]): DimensionDef[] {
  const filterDims: DimensionDef[] = [];
  for (const filter of filterStack) {
    if (filter.values.length === 0) {
      throw new Error(
        `[planner] Filter on column "${filter.column}" has empty values array. ` +
        `Filters must specify at least one value.`
      );
    }
    const dim = getDimensionByFilterColumn(filter.column);
    if (!dim) {
      throw new Error(
        `[planner] Unknown filter column "${filter.column}". ` +
        `No registered dimension has this filterColumn. Check the registry.`
      );
    }
    filterDims.push(dim);
  }
  return filterDims;
}

// ============================================================================
// Routing strategy decision
// ============================================================================

/**
 * Decide whether to query the materialized view, raw transactions, or
 * (future) a hybrid composition.
 *
 * Current rules:
 *   - txn leaf (groupBy="txn") always uses raw transactions
 *   - Any non-MV-source dimension in the path forces raw transactions
 *   - Any non-MV-source dimension in the filterStack forces raw too
 *     (a vendor filter on a facility-path query can't run on the MV
 *     because the MV doesn't carry vendor)
 *   - All-MV-source paths and filters use the MV
 *
 * Future "hybrid" case will fire when partially-derivable dimensions
 * (Resolver Category-from-GL, Region-from-Facility) enter the registry.
 * v1 dimensions never trigger hybrid.
 */
function decideRoutingStrategy(
  dimensionsUsed: DimensionDef[],
  filterDims: DimensionDef[],
  groupByDim: DimensionDef,
): RoutingStrategy {
  if (groupByDim.id === "txn") return "raw";
  const allDims = [...dimensionsUsed, ...filterDims];
  if (allDims.some(d => d.source !== "mv")) return "raw";
  return "mv";
}

// ============================================================================
// PPD rule derivation
// ============================================================================

/**
 * Derive the PPD denominator rules for both row-level and KPI-level
 * aggregation, based on what the user is grouping by and what filters
 * they have applied.
 *
 * The two rules can differ — see the LogicalPlan ppdRowRule / ppdKpiRule
 * docstrings for the rationale.
 *
 * Decision matrix:
 *
 *   groupBy     | facility filter   | ppdRowRule        | ppdKpiRule
 *   ------------|-------------------|-------------------|-------------------
 *   txn         | any               | none              | (depends on filter)
 *   facility    | none              | facility-scoped   | portfolio-shared
 *   facility    | 1                 | facility-scoped   | facility-scoped
 *   facility    | 2+                | facility-scoped   | subset-scoped
 *   gl/vendor/* | none              | dim's registry    | portfolio-shared
 *               |                   |   declared rule   |
 *   gl/vendor/* | 1                 | facility-scoped   | facility-scoped
 *   gl/vendor/* | 2+                | subset-scoped     | subset-scoped
 *
 * Note: even when groupBy="txn" (no row PPD), the KPI block still
 * computes PPD using the appropriate denominator. computedFields
 * reflects row-level computation only — KPI computation happens
 * separately in the engine.
 */
function derivePpdRules(
  groupByDim: DimensionDef,
  filterStack: Filter[],
): { ppdRowRule: PpdRule; ppdKpiRule: PpdRule } {
  // Locate the facility filter, if any.
  const facilityFilter = filterStack.find(f => f.column === "facility_id");
  const facilityCount = facilityFilter?.values.length ?? 0;

  // KPI rule depends only on the aggregate facility scope.
  // We cannot distinguish "all facilities filtered" from "subset" without
  // knowing portfolio size — engine resolves at fetch time. Plan declares
  // "subset-scoped" for any 2+ filter; runtime collapses to portfolio-shared
  // if the count equals total facilities. This is intentional: the Plan
  // describes intent, the engine computes against reality.
  let ppdKpiRule: PpdRule;
  if (facilityCount === 0) {
    ppdKpiRule = "portfolio-shared";
  } else if (facilityCount === 1) {
    ppdKpiRule = "facility-scoped";
  } else {
    ppdKpiRule = "subset-scoped";
  }

  // Row rule depends on whether each row represents a single facility's
  // worth of data, AND on the filter scope.
  let ppdRowRule: PpdRule;

  if (groupByDim.id === "txn") {
    // Transaction leaf: rows don't carry PPD. KPI still does.
    ppdRowRule = "none";
  } else if (groupByDim.id === "facility") {
    // Each row IS one facility — row PPD uses that facility's PD.
    ppdRowRule = "facility-scoped";
  } else if (facilityCount === 1) {
    // Filter scopes the entire query to one facility.
    // Every row inherits that facility's denominator.
    ppdRowRule = "facility-scoped";
  } else if (facilityCount >= 2) {
    // Filter scopes to a subset of facilities. Every row shares the
    // subset denominator (sum of those facilities' PD).
    ppdRowRule = "subset-scoped";
  } else {
    // No facility filter, groupBy is gl/vendor/etc. Use the dimension's
    // declared PPD rule — typically "portfolio-shared" (rows share the
    // full portfolio denominator).
    ppdRowRule = groupByDim.ppdRule;
  }

  return { ppdRowRule, ppdKpiRule };
}

// ============================================================================
// Computed fields list
// ============================================================================

/**
 * Determine which row-level fields the kernel will compute at execution.
 *
 *   - "spend"  always (every query produces some form of spend)
 *   - "budget" only when querying the MV (raw transactions don't carry
 *              budget — it lives only in the budget-joined MV)
 *   - "ppd"    only when ppdRowRule != "none" (txn leaf has no row PPD)
 *
 * KPI-level fields are not represented here — they are always computed.
 */
function computeFieldList(
  routingStrategy: RoutingStrategy,
  ppdRowRule: PpdRule,
): ("spend" | "budget" | "ppd")[] {
  const fields: ("spend" | "budget" | "ppd")[] = ["spend"];
  if (routingStrategy === "mv") {
    fields.push("budget");
  }
  if (ppdRowRule !== "none") {
    fields.push("ppd");
  }
  return fields;
}