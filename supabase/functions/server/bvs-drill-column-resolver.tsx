/**
 * BVS Query Engine (Perspective-Based) — Ship 5 Phase 1.4
 *
 * Column resolver — Perspective-Semantic Layer access helper.
 *
 * Pure function. No I/O. Single export. Wraps the registry's
 * COLUMN_SETS / COLUMN_SETS_DEFAULT lookup with the right precedence:
 *
 *   1. Perspective-specific override for (perspective, groupBy)
 *      — wins if present
 *   2. Default column set for the groupBy dimension
 *      — fallback
 *   3. Throw — surfaces config gaps loudly per the Extensibility Constraint
 *
 * The resolver is consumed by the engine endpoint (Phase 2) when
 * shaping the row payload. It is not used by the planner or renderer
 * directly — the SQL output always exposes the union of possible
 * columns; the resolver decides which subset the wire payload includes.
 *
 * Cross-references:
 *   - Ship 5 v3 spec §4 (Perspective-Semantic Layer)
 *   - bvs-drill-registry.tsx Section 6 (column sets)
 *   - Ari second-doc review #7 (column sets per perspective × dimension)
 */

import {
  type Perspective,
  type DimensionId,
  type ColumnId,
  type LogicalPlan,
  getColumnSet,
} from "./bvs-drill-registry.tsx";

// ============================================================================
// Public entry point
// ============================================================================

/**
 * Resolve the column set the engine should expose for a given Plan.
 *
 * Inputs are derived from the Plan:
 *   - perspective: from path[0] (the canonical root)
 *   - dimension: from plan.groupBy (the row grain)
 *
 * Output: the ordered array of ColumnId values the engine populates
 * on each row of the response. The renderer's SQL exposes a superset
 * (always includes label, spend, committed, txn_count); the engine
 * filters and shapes to this exact set.
 *
 * Throws on missing column set (Extensibility Constraint).
 *
 * Examples:
 *
 *   resolveColumns({ ..., path: ["facility", "gl"], groupBy: "gl" })
 *     → COLUMN_SETS.facility?.gl ?? COLUMN_SETS_DEFAULT.gl
 *     → default gl columns: label, budget, spend, variance,
 *       variancePercent, personDays, spendPPD, budgetPPD,
 *       variancePPD, trend, status
 *
 *   resolveColumns({ ..., path: ["facility", "gl", "vendor"], groupBy: "vendor" })
 *     → COLUMN_SETS.facility.vendor (perspective-specific override)
 *     → vendor-as-operational-supplier columns: label, spend, committed,
 *       txnCount, avgTransaction, lastTxnDate, trend
 *
 *   resolveColumns({ ..., path: ["vendor"], groupBy: "vendor" })
 *     → COLUMN_SETS.vendor.vendor undefined → COLUMN_SETS_DEFAULT.vendor
 *     → portfolio-context vendor columns
 */
export function resolveColumns(plan: LogicalPlan): ColumnId[] {
  const perspective = plan.path[0] as Perspective;
  return getColumnSet(perspective, plan.groupBy);
}

/**
 * Convenience overload for direct (perspective, dimension) calls
 * outside the planner — used by tests and the engine's column shaper.
 */
export function resolveColumnsFor(
  perspective: Perspective,
  dimension: DimensionId,
): ColumnId[] {
  return getColumnSet(perspective, dimension);
}