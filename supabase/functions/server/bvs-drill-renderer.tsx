/**
 * BVS Query Engine (Perspective-Based) — Ship 5 Phase 1.3
 *
 * SQL renderer.
 *
 * Pure function. No I/O, no side effects, no external dependencies
 * beyond types from the registry. Takes a Logical Plan and produces
 * the SQL strings the engine will execute.
 *
 * Critical scoping note (matches existing build behavior):
 *
 *   For "mv" routingStrategy queries, the existing build runs TWO
 *   parallel queries — one against bvs.mv_spend_budget_monthly for
 *   budget, one against bvs.transactions for spend (with spend-mode
 *   flexibility) — and joins them in JS. The MV does not provide
 *   spend-mode-flexible columns, so spend always comes from raw
 *   transactions when the user has selected a non-default spend mode.
 *
 *   The renderer follows that pattern. For "mv" routing, it returns
 *   { spend, budget } — two SQL strings. The engine runs both in
 *   parallel and joins the result sets.
 *
 *   For "raw" routing, it returns { spend } only — vendors and txn
 *   leaves do not carry budget data.
 *
 *   For "hybrid" routing, the renderer throws. v1 has no hybrid
 *   sources; the case lands when Resolver Category dimension joins
 *   the registry.
 *
 * Cross-references:
 *   - Ship 5 v3 spec §2.2 (planner + renderer split)
 *   - Ship 5 v3 spec §4 (source routing)
 *   - Existing helper: txnSpendExpr (line 94 of bvs-queries-4d.tsx)
 *   - Phase 1.2 deliverable: bvs-drill-planner.tsx
 */

import {
  type DimensionId,
  type DimensionDef,
  type Filter,
  type SpendMode,
  type LogicalPlan,
  getDimension,
} from "./bvs-drill-registry.tsx";

// ============================================================================
// Public entry point
// ============================================================================

export type RenderedSQL = {
  /** Spend query — always present. Targets bvs.transactions with the
   *  appropriate WHERE and GROUP BY for the Plan. Includes spend-mode
   *  shaping via txnSpendExpr semantics. */
  spend: string;

  /** Budget query — present only when routingStrategy is "mv".
   *  Targets bvs.mv_spend_budget_monthly. Result joins to spend by
   *  the groupBy column at engine execution time. */
  budget?: string;
};

/**
 * Transform a Logical Plan into the SQL strings the engine will execute.
 *
 * Throws on:
 *   - routingStrategy === "hybrid" (architected, not implemented in v1)
 *   - Unknown groupBy dimension (registry lookup failure)
 *
 * Does NOT throw on:
 *   - filterStack containing a column unrelated to the path. Validation
 *     of filter relevance is the planner's responsibility (already done
 *     by the time the Plan reaches the renderer).
 */
export function renderSQL(plan: LogicalPlan): RenderedSQL {
  if (plan.routingStrategy === "hybrid") {
    throw new Error(
      `[renderer] Hybrid routing not implemented in v1. ` +
      `This case lands when partially-derivable dimensions enter the ` +
      `registry (e.g. Resolver Category-from-GL).`
    );
  }

  if (plan.groupBy === "txn") {
    return { spend: renderTxnLeafSQL(plan) };
  }

  const spend = renderSpendSQL(plan);

  if (plan.routingStrategy === "mv") {
    const budget = renderBudgetSQL(plan);
    return { spend, budget };
  }

  // routingStrategy === "raw" and groupBy !== "txn" (vendor non-leaf cases)
  return { spend };
}

// ============================================================================
// Spend query rendering
// ============================================================================

/**
 * Render the spend query against bvs.transactions.
 *
 * Uniform rules across all groupBys:
 *   - Always JOIN gl_accounts (g) — either via the labelJoin (when
 *     groupBy=gl) or as a hygiene JOIN (otherwise).
 *   - Filter `t.excluded = false` UNLESS groupBy is "gl" (gl drills
 *     surface per-row excluded state instead of filtering).
 *   - Filter `g.excluded = false` UNLESS gl is in scope
 *     (groupBy="gl" OR gl_account_id in filterStack). When gl is
 *     in scope, the user's filter or grouping defines the relevant
 *     gl set; we don't second-guess it.
 *   - Surface `g.excluded AS gl_excluded` ONLY when groupBy="gl"
 *     (each row IS one gl, so per-row excluded state is meaningful).
 *
 * Shape:
 *   SELECT
 *     {groupBy expr} AS entity_id,
 *     {label columns},
 *     {g.excluded AS gl_excluded if groupBy=gl},
 *     SUM({spendModeExpr}) AS total_spend,
 *     SUM(t.amount_committed) AS total_committed,
 *     COUNT(*) AS txn_count
 *   FROM bvs.transactions t
 *   {gl hygiene JOIN unless groupBy=gl}
 *   {labelJoin for groupBy dim}
 *   WHERE
 *     t.txn_date >= '{start}'::date
 *     AND t.txn_date <= '{end}'::date
 *     {t.excluded = false unless groupBy=gl}
 *     {g.excluded = false unless gl in scope}
 *     {filterStack predicates}
 *   GROUP BY {groupBy expr}, {label cols}, {g.excluded if surfaced}
 */
function renderSpendSQL(plan: LogicalPlan): string {
  const groupByDim = getDimension(plan.groupBy);
  const spendExpr = txnSpendExpr(plan.spendMode, "t");

  // GROUP BY column on the transactions side.
  const groupByCol = txnGroupByColumn(groupByDim.id);
  const groupByExpr = groupByCol === null
    ? `DATE_TRUNC('month', t.txn_date)::date`
    : `t.${groupByCol}`;

  // Excluded-handling decisions.
  const surfaceGlExcluded = plan.groupBy === "gl";
  const filterGlExcluded =
    plan.groupBy !== "gl" &&
    !plan.filterStack.some(f => f.column === "gl_account_id");
  const filterTxnExcluded = plan.groupBy !== "gl";

  // JOINs: hygiene gl JOIN unless groupBy=gl (in which case labelJoin
  // already emits the gl_accounts JOIN with alias "g").
  const labelJoinClause = renderLabelJoin(groupByDim, "t");
  const glHygieneJoin = plan.groupBy === "gl"
    ? "" // labelJoin already covers it
    : renderGlHygieneJoin("t");

  // SELECT fields.
  const labelSelectFields = renderLabelSelectFields(groupByDim);
  const glExcludedSelect = surfaceGlExcluded
    ? "g.excluded AS gl_excluded"
    : "";

  const selectFields = [
    `${groupByExpr} AS entity_id`,
    labelSelectFields,
    glExcludedSelect,
    `SUM(${spendExpr}) AS total_spend`,
    `SUM(t.amount_committed) AS total_committed`,
    `COUNT(*) AS txn_count`,
  ].filter(Boolean).join(",\n    ");

  // WHERE clause.
  const where = renderWhere(
    "t",
    plan.filterStack,
    plan.timeframe,
    { filterTxnExcluded, filterGlExcluded },
  );

  // GROUP BY columns.
  const labelGroupByFields = renderLabelGroupByFields(groupByDim);
  const glExcludedGroupBy = surfaceGlExcluded ? "g.excluded" : "";

  const groupByClause = [
    groupByExpr,
    labelGroupByFields,
    glExcludedGroupBy,
  ].filter(Boolean).join(", ");

  return `SELECT
    ${selectFields}
  FROM bvs.transactions t${glHygieneJoin}${labelJoinClause}
  ${where}
  GROUP BY ${groupByClause}`;
}

// ============================================================================
// Budget query rendering (MV-source only)
// ============================================================================

/**
 * Render the budget query against bvs.mv_spend_budget_monthly.
 *
 * Uniform rules (mirror spend query rules at MV layer):
 *   - No JOIN needed — MV has gl_excluded denormalized.
 *   - Filter `mv.gl_excluded = false` UNLESS gl is in scope.
 *   - Surface `mv.gl_excluded` in SELECT/GROUP BY ONLY when groupBy="gl".
 *
 * Only invoked when routingStrategy === "mv".
 * The MV is in-month-grain, so date filtering uses month bounds, not
 * txn_date. The alias is "mv" instead of "t".
 */
function renderBudgetSQL(plan: LogicalPlan): string {
  const groupByDim = getDimension(plan.groupBy);

  // GROUP BY column on the MV.
  const groupByCol = mvGroupByColumn(groupByDim.id);
  if (groupByCol === null) {
    throw new Error(
      `[renderer] Cannot render budget query for groupBy="${groupByDim.id}" ` +
      `against MV. Dimension is not present in mv_spend_budget_monthly. ` +
      `Planner should have routed to "raw" instead.`
    );
  }
  const groupByExpr = `mv.${groupByCol}`;

  // Excluded-handling decisions (same logic as spend query).
  const surfaceGlExcluded = plan.groupBy === "gl";
  const filterGlExcluded =
    plan.groupBy !== "gl" &&
    !plan.filterStack.some(f => f.column === "gl_account_id");

  const selectFields = [
    `${groupByExpr} AS entity_id`,
    surfaceGlExcluded ? `mv.gl_excluded` : null,
    `SUM(mv.budget_amount) AS total_budget`,
  ].filter(Boolean).join(",\n    ");

  const groupByClause = [
    groupByExpr,
    surfaceGlExcluded ? `mv.gl_excluded` : null,
  ].filter(Boolean).join(", ");

  const where = renderWhereMv(plan.filterStack, plan.timeframe, { filterGlExcluded });

  return `SELECT
    ${selectFields}
  FROM bvs.mv_spend_budget_monthly mv
  ${where}
  GROUP BY ${groupByClause}`;
}

// ============================================================================
// Transaction leaf rendering
// ============================================================================

/**
 * Render the transaction-leaf query. Returns row-grain transaction
 * data, not aggregated. Includes line-item fields (po, invoice, type).
 *
 * Shape:
 *   SELECT
 *     t.id, t.txn_date, t.amount_actual, t.amount_committed, t.excluded,
 *     t.reference, t.po_number, t.invoice_number, t.txn_type,
 *     g.excluded AS gl_excluded
 *   FROM bvs.transactions t
 *   JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
 *   WHERE
 *     t.txn_date >= '{start}'::date
 *     AND t.txn_date <= '{end}'::date
 *     {filterStack predicates}
 *   ORDER BY t.txn_date DESC, t.id ASC
 *
 * Always raw transactions. Spend mode applies via post-query shaping
 * by the engine (renderer just exposes the raw amount columns).
 */
function renderTxnLeafSQL(plan: LogicalPlan): string {
  // Leaf queries: don't filter t.excluded or g.excluded — surface both
  // for UI marking. Each individual transaction needs to be visible.
  const where = renderWhere(
    "t",
    plan.filterStack,
    plan.timeframe,
    { filterTxnExcluded: false, filterGlExcluded: false },
  );

  const selectFields = [
    `t.id`,
    `t.txn_date`,
    `t.amount_actual`,
    `t.amount_committed`,
    `t.excluded`,
    
    
    
    
    `g.excluded AS gl_excluded`,
  ].join(",\n    ");

  return `SELECT
    ${selectFields}
  FROM bvs.transactions t
  JOIN bvs.gl_accounts g ON g.id = t.gl_account_id
  ${where}
  ORDER BY t.txn_date DESC, t.id ASC`;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Spend-mode column expression. Mirrors the existing build's
 * txnSpendExpr helper at line 94 of bvs-queries-4d.tsx — kept
 * structurally identical to preserve composer parity.
 */
function txnSpendExpr(spendMode: SpendMode, alias: string): string {
  if (spendMode === "actual") return `${alias}.amount_actual`;
  if (spendMode === "commitment") return `${alias}.amount_committed`;
  return `(${alias}.amount_actual + ${alias}.amount_committed)`;
}

/**
 * Translate a DimensionId to its column on bvs.transactions.
 * Returns null for "month" (computed expression instead of a column).
 * Throws for dimensions not present on transactions (txn).
 */
function txnGroupByColumn(id: DimensionId): string | null {
  switch (id) {
    case "facility": return "facility_id";
    case "gl":       return "gl_account_id";
    case "vendor":   return "vendor_id";
    case "month":    return null; // Computed: DATE_TRUNC('month', t.txn_date)
    case "txn":
      throw new Error(`[renderer] groupBy="txn" should use renderTxnLeafSQL.`);
    default:
      throw new Error(
        `[renderer] Dimension "${id}" not yet supported on bvs.transactions. ` +
        `Reserved dimensions (gl_group, category, department, region) require ` +
        `schema work before rendering.`
      );
  }
}

/**
 * Translate a DimensionId to its column on bvs.mv_spend_budget_monthly.
 * Returns null for dimensions not present in the MV (vendor, txn).
 */
function mvGroupByColumn(id: DimensionId): string | null {
  switch (id) {
    case "facility": return "facility_id";
    case "gl":       return "gl_account_id";
    case "month":    return "month";
    case "vendor":   return null; // Vendor not in MV
    case "txn":      return null; // Leaf-only; never via MV
    default:
      // Reserved dimensions: gl_group/category/department/region
      // are mv-eligible per their registry source declaration but
      // require schema work before they have real columns.
      return null;
  }
}

/**
 * Render the JOIN clause needed to fetch the row's label and any
 * excluded flag from the dimension table.
 *
 * Returns the empty string when no labelJoin is declared. Otherwise
 * returns a leading newline + JOIN clause for embedding into the
 * surrounding query.
 *
 * Renderer uses INNER JOIN (matches existing build pattern at lines
 * 488, 666, etc.). LEFT JOIN would be safer if dimension rows could
 * be missing; v1 dimensions have FK referential integrity, so INNER
 * is correct.
 */
function renderLabelJoin(dim: DimensionDef, factAlias: string): string {
  if (!dim.labelJoin) return "";
  const lj = dim.labelJoin;
  return `\n  JOIN ${lj.table} ${lj.alias} ON ${lj.alias}.${lj.pkColumn} = ${factAlias}.${lj.factColumn}`;
}

/**
 * Render the SELECT fields contributed by the labelJoin, if any.
 * Each labelColumn becomes `${alias}.${col} AS ${alias}_${col}` so
 * the engine's label-assembly step can find them by deterministic name.
 */
function renderLabelSelectFields(dim: DimensionDef): string {
  if (!dim.labelJoin) return "";
  const lj = dim.labelJoin;
  return lj.labelColumns
    .map(col => `${lj.alias}.${col} AS ${lj.alias}_${col}`)
    .join(",\n    ");
}

/**
 * Render the GROUP BY columns contributed by the labelJoin, if any.
 */
function renderLabelGroupByFields(dim: DimensionDef): string {
  if (!dim.labelJoin) return "";
  const lj = dim.labelJoin;
  return lj.labelColumns.map(col => `${lj.alias}.${col}`).join(", ");
}

/**
 * Render the gl hygiene JOIN. Used when groupBy is NOT gl, to bring
 * gl_accounts into scope for the excluded check (and consistency with
 * the existing build's pattern of always-join-gl).
 */
function renderGlHygieneJoin(factAlias: string): string {
  const glDim = getDimension("gl");
  if (!glDim.labelJoin) return "";
  const lj = glDim.labelJoin;
  return `\n  JOIN ${lj.table} ${lj.alias} ON ${lj.alias}.${lj.pkColumn} = ${factAlias}.${lj.factColumn}`;
}

/**
 * Render the WHERE clause for a transactions-side query.
 *
 * Composes:
 *   - Date range on t.txn_date
 *   - t.excluded = false (when filterTxnExcluded)
 *   - g.excluded = false (when filterGlExcluded; requires gl JOIN in scope)
 *   - Each filter as t.{column} IN (...) or t.{column} = '...'
 */
function renderWhere(
  alias: string,
  filterStack: Filter[],
  timeframe: { start: string; end: string },
  excludedFlags: { filterTxnExcluded: boolean; filterGlExcluded: boolean },
): string {
  const predicates: string[] = [
    `${alias}.txn_date >= '${timeframe.start}'::date`,
    `${alias}.txn_date <= '${timeframe.end}'::date`,
  ];

  if (excludedFlags.filterTxnExcluded) {
    predicates.push(`${alias}.excluded = false`);
  }
  if (excludedFlags.filterGlExcluded) {
    predicates.push(`g.excluded = false`);
  }

  for (const f of filterStack) {
    predicates.push(renderFilterPredicate(alias, f));
  }

  return `WHERE\n    ` + predicates.join("\n    AND ");
}

/**
 * Render the WHERE clause for an MV-side query. MV uses month-grain
 * date filtering, not txn_date. MV has gl_excluded denormalized so
 * no JOIN is needed for the excluded check.
 */
function renderWhereMv(
  filterStack: Filter[],
  timeframe: { start: string; end: string },
  excludedFlags: { filterGlExcluded: boolean },
): string {
  const predicates: string[] = [
    `mv.month >= date_trunc('month', '${timeframe.start}'::date)::date`,
    `mv.month <= '${timeframe.end}'::date`,
  ];

  if (excludedFlags.filterGlExcluded) {
    predicates.push(`mv.gl_excluded = false`);
  }

  for (const f of filterStack) {
    // Vendor filter would be a problem on MV — but the planner already
    // routes such queries to "raw". This path only fires for facility/gl
    // filters which the MV supports natively.
    predicates.push(renderFilterPredicate("mv", f));
  }

  return `WHERE\n    ` + predicates.join("\n    AND ");
}

/**
 * Render a single filter as a SQL predicate. Single-value filters use
 * = with quoted literal; multi-value filters use IN (...).
 *
 * Note on SQL injection: filter values reach this renderer from the
 * engine endpoint, which has already validated them as UUIDs against
 * the registry's filterColumn metadata. Direct string interpolation
 * is the existing build's pattern (see lines 489, 666, etc.). When the
 * engine becomes the sole serving path (post-Phase 6), we may shift
 * to parameterized queries; for now, parity with the existing build
 * is the priority.
 */
function renderFilterPredicate(alias: string, f: Filter): string {
  if (f.values.length === 1) {
    return `${alias}.${f.column} = '${f.values[0]}'`;
  }
  const valueList = f.values.map(v => `'${v}'`).join(", ");
  return `${alias}.${f.column} IN (${valueList})`;
}