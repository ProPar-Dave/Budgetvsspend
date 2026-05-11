/**
 * Database-Facing Types
 *
 * These types represent normalized, relational database records.
 * They are structurally separate from the payload-facing types
 * consumed by the UI (ReportView, ReportRow, etc.).
 *
 * Naming convention: Db* prefix distinguishes database shape from payload shape.
 */

// ---------------------------------------------------------------------------
// Core entity records
// ---------------------------------------------------------------------------

export type DbFacility = {
  id: string
  name: string
}

export type DbGlAccount = {
  id: string
  code: string
  name: string
  displayName: string
  excluded: boolean
}

export type DbVendor = {
  id: string
  name: string
}

export type DbTransaction = {
  id: string
  label: string
  type: string
  date: string
  po: string | null
  invoice: string | null
}

// ---------------------------------------------------------------------------
// Report context record
// ---------------------------------------------------------------------------

export type DbReportContext = {
  id: string
  timeframeStart: string
  timeframeEnd: string
  timeframeType: string
  viewBy: string
  pivotBy: string
  metric: string
  spendMode: string
}

// ---------------------------------------------------------------------------
// Time bucket records
// ---------------------------------------------------------------------------

export type DbTimeBucket = {
  id: string
  contextId: string
  label: string
  start: string
  end: string
  bucketType: "DAY" | "WEEK" | "MONTH" | "QUARTER" | "FULL"
  timeModel: "CALENDAR"
  decompositionId: string
}

// ---------------------------------------------------------------------------
// KPI records
// ---------------------------------------------------------------------------

export type DbKpiReconciliation = {
  kpiId: string
  rowCount: number
  includedRows: number
  excludedRows: number
  checksum: string
}

export type DbKpi = {
  id: string
  viewId: string
  budget: number
  consumed: number
  variance: number
  percent: number | null
  excludedSpend: number
  status?: "over_budget" | "on_track" | "under_budget" | "excluded"
  reconciliation: DbKpiReconciliation
}

// ---------------------------------------------------------------------------
// Row records (normalized)
// ---------------------------------------------------------------------------

export type DbEntityType = "Facility" | "GL Account" | "Vendor" | "Transaction"

export type DbTxnType = "PO" | "INVOICE" | "PO_AND_INVOICE" | "MANUAL_ACCRUAL" | null

export type DbRow = {
  id: string
  viewId: string
  entityType: DbEntityType
  entityId: string
  label: string
  budget: number | null
  spend: number
  committed: number
  variance: number | null
  variancePercent?: number | null
  status?: "over_budget" | "on_track" | "under_budget" | "excluded"
  excluded: boolean
  childViewId: string | null
  po: string | null
  invoice: string | null
  txnType?: DbTxnType
  // Vendor drill-down operational fields (no budget at vendor level)
  txnCount?: number
  avgTransaction?: number
  lastTxnDate?: string | null
  // Facility metadata
  facilityType?: string | null
  censusValue?: number | null
  censusBasis?: string | null
  // PPD computation fields
  personDays?: number | null
  monthlyPersonDays?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Row time bucket value records (junction: row × bucket → values)
// ---------------------------------------------------------------------------

export type DbRowTimeBucket = {
  rowId: string
  bucketId: string
  total: number
  actual: number
  commitment: number
  deduplicated?: boolean
}

// ---------------------------------------------------------------------------
// Row summary / derived records
// ---------------------------------------------------------------------------

export type DbSpendComposition = {
  rowId: string
  actualTotal: number
  commitmentOpen: number
  commitmentRealized: number
}

// ---------------------------------------------------------------------------
// Census context records
// ---------------------------------------------------------------------------

export type DbCensusContext = {
  rowId: string
  basedOn: "ACTUAL" | "PROJECTED" | "MIXED"
  actualPercent: number
  projectedPercent?: number
  impactsPPD: boolean
}

// ---------------------------------------------------------------------------
// Decomposition records
// ---------------------------------------------------------------------------

export type DbDecomposition = {
  rowId: string
  source: "MONTHLY" | "WEEKLY" | "DAILY" | "QUARTERLY"
  method: "DAILY_PRORATION" | "EQUAL_SPLIT" | "ACTUAL"
  remainderHandling: "CARRY_FORWARD" | "DISTRIBUTE"
  auditId: string
}

// ---------------------------------------------------------------------------
// Lineage records
// ---------------------------------------------------------------------------

export type DbLineage = {
  rowId: string
  budget: string
  spend: string
  census?: string
  time?: string
}

// ---------------------------------------------------------------------------
// Aggregation records
// ---------------------------------------------------------------------------

export type DbAggregation = {
  rowId: string
  method: "SUM_CHILDREN" | "DIRECT"
  childReconciliation: "MATCH" | "PENDING"
}

// ---------------------------------------------------------------------------
// Drill records
// ---------------------------------------------------------------------------

export type DbDrill = {
  rowId: string
  nextPivot: string
  available: boolean
}

// ---------------------------------------------------------------------------
// Exclusion records
// ---------------------------------------------------------------------------

export type DbExclusion = {
  rowId: string
  impact: "NONE" | "PARTIAL" | "FULL"
  reason: string | null
  source: string | null
  propagated: boolean
}

// ---------------------------------------------------------------------------
// Report meta records
// ---------------------------------------------------------------------------

export type DbReportMeta = {
  id: string
  calculationEngineVersion: string
  kernelVersion: string
  glIsCanonical: boolean
  categoryNotUsed: boolean
  spendRuleMode: string
  spendRuleDeduplication: string
  timeRuleModel: string
  timeRuleSupportsMixedModels: boolean
}

// ---------------------------------------------------------------------------
// View record (top-level join target)
// ---------------------------------------------------------------------------

export type DbBreadcrumbSegment = {
  viewId: string
  position: number
  label: string
  targetViewId: string | null
}

export type DbView = {
  id: string
  contextId: string
  metaId: string
  scopeLabel: string
  entityTypeLabel: string
  kpi?: DbKpi
}

// ---------------------------------------------------------------------------
// Census display record (deterministic stub for UI census rendering)
// ---------------------------------------------------------------------------

export type DbCensusDisplay = {
  rowId: string
  entityType: DbEntityType
  entries: { type: string; value: number }[]
}