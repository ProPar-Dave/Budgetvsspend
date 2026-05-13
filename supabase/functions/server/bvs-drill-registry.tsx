// Re-export shim — registry is inlined in bvs-queries.tsx because Make's
// bundler doesn't pick up newly-created standalone files.
export {
  getDimension,
  getDimensionByFilterColumn,
  getColumnSet,
  validateDrillPath,
  PERSPECTIVE_DEFAULTS,
} from "./bvs-queries.tsx";
export type {
  SpendMode,
  RoutingStrategy,
  PpdRule,
  Perspective,
  DimensionId,
  Filter,
  Timeframe,
  LabelJoin,
  DimensionDef,
  LogicalPlan,
  Lineage,
  ColumnId,
} from "./bvs-queries.tsx";
