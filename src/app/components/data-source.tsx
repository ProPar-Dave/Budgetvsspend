/**
 * Data Source — Payload Contract Types & Public API
 *
 * This module defines the payload-facing types consumed by the UI
 * and provides a thin public API that delegates to the repository layer.
 *
 * Payload contract domains:
 *   reportContext  — current control/view state
 *   timeBuckets    — governed time period definitions
 *   kpi            — top-level KPI with reconciliation
 *   rows           — renderable row data with full metadata
 *   meta           — trust, governance, and calculation engine metadata
 */

import { repository } from "./repository"

// ---------------------------------------------------------------------------
// Types — Payload Contract
// ---------------------------------------------------------------------------

export type EntityType = "Facility" | "GL Account" | "Vendor" | "Transaction"

export type Facility = { id: string; name: string }
export type GlAccount = { id: string; code: string; name: string; displayName: string; excluded: boolean }
export type Vendor = { id: string; name: string }
export type Transaction = { id: string; label: string; type: string; date: string; po: string | null; invoice: string | null }

// --- Time Buckets (governed) ---

export type TimeBucketDefinition = {
  id: string
  label: string
  start: string
  end: string
  bucketType: "DAY" | "WEEK" | "MONTH" | "QUARTER" | "FULL"
  timeModel: "CALENDAR"
  decompositionId: string
}

export type TimeBucketValue = {
  total: number
  actual: number
  commitment: number
  deduplicated?: boolean
}

// --- Row-level metadata ---

export type SpendComposition = {
  actualTotal: number
  commitmentOpen: number
  commitmentRealized: number
}

// --- Census Context (exact contract fields only) ---

export type CensusContext = {
  basedOn: "ACTUAL" | "PROJECTED" | "MIXED"
  actualPercent: number
  projectedPercent?: number
  impactsPPD: boolean
}

export type Decomposition = {
  source: "MONTHLY" | "WEEKLY" | "DAILY" | "QUARTERLY"
  method: "DAILY_PRORATION" | "EQUAL_SPLIT" | "ACTUAL"
  remainderHandling: "CARRY_FORWARD" | "DISTRIBUTE"
  auditId: string
}

export type Lineage = {
  budget: string
  spend: string
  census?: string
  time?: string
}

export type Aggregation = {
  method: "SUM_CHILDREN" | "DIRECT"
  childReconciliation: "MATCH" | "PENDING"
}

export type Drill = {
  nextPivot: string
  available: boolean
}

export type ExclusionInfo = {
  reason: string
  source: string
  propagated: boolean
}

// --- KPI ---

export type KpiReconciliation = {
  rowCount: number
  includedRows: number
  excludedRows: number
  checksum: string
}

export type ReportKpi = {
  budget: number
  consumed: number
  variance: number
  percent: number
  excludedSpend: number
  status?: "over_budget" | "on_track" | "under_budget" | "excluded"
  reconciliation: KpiReconciliation
  // PPD census metadata (populated for facility views)
  totalPersonDays?: number
  monthlyPersonDays?: Record<string, number>
  projectionStatus?: "ObservedOnly" | "ObservedAndProjected" | "MissingCensus" | null
  // Ship 4b: server-computed PPD values (present on v2 enriched payloads only)
  spendPPD?: number | null
  budgetPPD?: number | null
  variancePPD?: number | null
}

// --- Row ---

export type ReportRow = {
  id: string
  entityType: EntityType
  entityId: string
  label: string
  budget: number | null
  spend: number
  variance: number | null
  variancePercent: number | null
  status: "Healthy" | "Over Budget" | "On Track" | "Under Budget" | "Excluded" | ""
  excluded: boolean
  childViewId: string | null
  // Governed time bucket values keyed by bucket id
  timeBuckets: Record<string, TimeBucketValue>
  // Raw fields preserved for transforms
  committed: number
  // Transaction-level fields
  po: string | null
  invoice: string | null
  txnType: "PO" | "INVOICE" | "PO_AND_INVOICE" | "MANUAL_ACCRUAL" | null
  // Enriched metadata
  spendComposition: SpendComposition | null
  censusContext: CensusContext | null
  decomposition: Decomposition | null
  lineage: Lineage | null
  aggregation: Aggregation | null
  exclusionImpact: "NONE" | "PARTIAL" | "FULL"
  exclusionInfo: ExclusionInfo | null
  drill: Drill | null
  // Vendor drill-down operational fields
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
  // Ship 4b: server-computed PPD values (present on v2 enriched payloads only)
  spendPPD?: number | null
  budgetPPD?: number | null
  variancePPD?: number | null
}

// --- Breadcrumb ---

export type BreadcrumbSegment = {
  label: string
  viewId: string | null // null = current (non-clickable), string = navigable
}

// --- Report Context ---

export type ReportContext = {
  timeframe: {
    start: string
    end: string
    type: string
  }
  viewBy: string
  pivotBy: string
  metric: string
  spendMode: string
}

// --- Meta ---

export type ReportMeta = {
  calculationEngineVersion: string
  kernelVersion: string
  governance: {
    glIsCanonical: boolean
    categoryNotUsed: boolean
  }
  spendRules: {
    mode: string
    deduplication: string
  }
  timeRules: {
    model: string
    supportsMixedModels: boolean
  }
}

// --- Report View (payload wrapper) ---

export type ReportView = {
  id: string
  breadcrumbPath: BreadcrumbSegment[]
  scopeLabel: string
  reportContext: ReportContext
  timeBuckets: TimeBucketDefinition[]
  kpi: ReportKpi
  rows: ReportRow[]
  entityTypeLabel: string // first-column header label
  meta: ReportMeta
}

export type OptionItem = { value: string; label: string }

// ---------------------------------------------------------------------------
// optionSets
// ---------------------------------------------------------------------------

export const optionSets = {
  pivotByOptions: [
    { value: "facility", label: "Facility" },
    { value: "glAccount", label: "GL Account" },
    { value: "vendor", label: "Vendor" },
  ] as OptionItem[],

  timeframeOptions: [
    { value: "last7Days", label: "Last 7 Days" },
    { value: "last30Days", label: "Last 30 Days" },
    { value: "monthToDate", label: "Month to Date" },
    { value: "lastMonth", label: "Last Month" },
    { value: "quarterToDate", label: "Quarter to Date" },
    { value: "lastQuarter", label: "Last Quarter" },
    { value: "yearToDate", label: "Year to Date" },
    { value: "last12Months", label: "Last 12 Months" },
    { value: "customRange", label: "Custom Range" },
  ] as OptionItem[],

  viewByOptions: [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
  ] as OptionItem[],

  metricOptions: [
    { value: "dollars", label: "Dollars" },
    { value: "ppd", label: "PPD" },
  ] as OptionItem[],

  spendModeOptions: [
    { value: "actual", label: "Actual" },
    { value: "commitment", label: "Commitment" },
    { value: "totalImpact", label: "Total Impact" },
  ] as OptionItem[],

  tableSizeOptions: [
    { value: "compact", label: "Compact" },
    { value: "standard", label: "Standard" },
    { value: "comfortable", label: "Comfortable" },
  ] as OptionItem[],
}

// ---------------------------------------------------------------------------
// reportState (initial defaults)
// ---------------------------------------------------------------------------

export type PivotBy = "facility" | "glAccount" | "vendor"
export type FacilityScope = "all" | string

export const reportStateDefaults = {
  pivotBy: "facility" as PivotBy,
  timeframe: "monthToDate",
  viewBy: "weekly",
  metric: "dollars",
  spendMode: "actual",
  tableSize: "standard",
  breadcrumbPath: [{ label: "Facilities", viewId: null }] as BreadcrumbSegment[],
  scopeLabel: "Facilities",
  activeViewId: "fac-root",
}

// ---------------------------------------------------------------------------
// Root view IDs per pivot
// ---------------------------------------------------------------------------

export const PIVOT_ROOT_VIEW: Record<PivotBy, string> = {
  facility: "fac-root",
  glAccount: "gl-root",
  vendor: "vendor-root",
}

// ---------------------------------------------------------------------------
// Public API — delegates to repository
// ---------------------------------------------------------------------------

export function getView(viewId: string): ReportView | undefined {
  return repository.getView(viewId)
}

export function getFacilityNames(): string[] {
  return repository.getFacilityNames()
}