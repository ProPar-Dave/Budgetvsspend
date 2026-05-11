/**
 * Repository / Adapter Boundary
 *
 * Defines the abstract interface between the UI and the data source.
 * The LocalAdapter implementation reads from database-shaped seed data
 * and transforms through the transformation layer.
 *
 * Data shaping logic (spend mode, timeframe multiplier, metric transform,
 * period expansion, census display, mapRowForTable) is relocated here
 * from App.tsx so the UI becomes a consumer, not a constructor.
 */

import type { ReportView, ReportKpi, BreadcrumbSegment } from "./data-source"
import type { DbCensusDisplay } from "./db-types"
import { assembleReportView } from "./transform"
import {
  dbViews, dbReportContexts, dbMeta, dbTimeBuckets,
  dbBreadcrumbs, dbRows, dbRowTimeBuckets, dbSpendCompositions,
  dbCensusContexts, dbDecompositions, dbLineages, dbAggregations,
  dbDrills, dbExclusions, dbFacilities, censusDisplayMap,
} from "./db-seed"

import { getTimeframeRange as computeRange, FALLBACK_ANCHOR } from "./timeframe-utils"

// ---------------------------------------------------------------------------
// Data shaping types (relocated from App.tsx)
// ---------------------------------------------------------------------------

export type Timeframe = "last7Days" | "last30Days" | "monthToDate" | "lastMonth" | "quarterToDate" | "lastQuarter" | "yearToDate" | "last12Months" | "customRange"
export type ViewBy = "daily" | "weekly" | "monthly" | "quarterly" | "fullTimeframe"
export type SpendMode = "actual" | "commitment" | "totalImpact"
export type Metric = "dollars" | "ppd"

export type TableRow = {
  name: string
  budget: number
  consumed: number
  committed: number
  variance: number
  childViewId: string | null
  excluded: boolean
  census: { type: string; value: number }[]
  po: string | null
  invoice: string | null
  txnType: "PO" | "INVOICE" | "PO_AND_INVOICE" | "MANUAL_ACCRUAL" | null
  period?: string
  // Vendor drill-down operational fields
  txnCount?: number
  avgTransaction?: number
  lastTxnDate?: string | null
  // Entity ID for sparkline lookup
  _entityId?: string
  // Server-provided status for display-only mapping
  _status?: "over_budget" | "on_track" | "under_budget" | "excluded"
  // Server-provided variance percent
  variancePercent?: number | null
  // Facility metadata
  facilityType?: string | null
  censusValue?: number | null
  censusBasis?: string | null
  // PPD computation
  _personDays?: number | null
  _ppdNull?: boolean
}

export type ProcessedViewData = {
  displayData: TableRow[]
  kpi: ReportKpi
  entityTypeLabel: string
  breadcrumbPath: BreadcrumbSegment[]
  scopeLabel: string
  isTransactionView: boolean
  isVendorView: boolean
  showPeriod: boolean
}

export type DataShapingParams = {
  spendMode: SpendMode
  timeframe: Timeframe
  metric: Metric
  viewBy: ViewBy
  facilityScope: string // "all" or facility name
  pivotBy: string
  rootViewId: string
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface ReportRepository {
  getView(viewId: string): ReportView | undefined
  getProcessedData(viewId: string, params: DataShapingParams): ProcessedViewData
  getFacilityNames(): string[]
}

// ---------------------------------------------------------------------------
// Timeframe / period logic (relocated from App.tsx)
// ---------------------------------------------------------------------------

const TIMEFRAME_MULTIPLIER: Record<Timeframe, number> = {
  last7Days: 0.25,
  last30Days: 1.0,
  monthToDate: 1.0,
  lastMonth: 1.25,
  quarterToDate: 3.0,
  lastQuarter: 3.0,
  yearToDate: 12.0,
  last12Months: 12.0,
  customRange: 1.0,
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function getTimeframeRange(tf: Timeframe, anchor: Date = FALLBACK_ANCHOR): { start: Date; end: Date } {
  return computeRange(tf, anchor)
}

// Ship 4c: accept optional anchor so callers with a real data anchor (bvs-adapter)
// can produce period labels in the data's actual year instead of FALLBACK_ANCHOR's
// hardcoded 2025. Defaults preserve LocalAdapter's legacy behavior.
export function generatePeriodLabels(tf: Timeframe, vb: ViewBy, anchor?: Date): string[] {
  const { start, end } = getTimeframeRange(tf, anchor)
  const labels: string[] = []

  if (vb === "monthly") {
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= end) {
      labels.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
      d.setMonth(d.getMonth() + 1)
    }
  } else if (vb === "weekly") {
    const d = new Date(start)
    const day = d.getDay()
    d.setDate(d.getDate() - ((day + 6) % 7))
    while (d <= end) {
      labels.push(`${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`)
      d.setDate(d.getDate() + 7)
    }
  } else if (vb === "daily") {
    const d = new Date(start)
    while (d <= end) {
      labels.push(`${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`)
      d.setDate(d.getDate() + 1)
    }
  } else if (vb === "quarterly") {
    const d = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1)
    while (d <= end) {
      labels.push(`Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`)
      d.setMonth(d.getMonth() + 3)
    }
  } else if (vb === "fullTimeframe") {
    labels.push(`${MONTHS[start.getMonth()]} ${start.getFullYear()} - ${MONTHS[end.getMonth()]} ${end.getFullYear()}`)
  }

  if (labels.length === 0) labels.push("Period 1")
  return labels
}

// ---------------------------------------------------------------------------
// ViewBy validity (relocated from App.tsx)
// ---------------------------------------------------------------------------

const VALID_VIEW_BY: Record<Timeframe, ViewBy[]> = {
  last7Days: ["daily", "fullTimeframe"],
  last30Days: ["daily", "weekly", "fullTimeframe"],
  monthToDate: ["daily", "weekly", "fullTimeframe"],
  lastMonth: ["daily", "weekly", "fullTimeframe"],
  quarterToDate: ["weekly", "monthly", "fullTimeframe"],
  lastQuarter: ["weekly", "monthly", "fullTimeframe"],
  yearToDate: ["monthly", "quarterly", "fullTimeframe"],
  last12Months: ["monthly", "quarterly", "fullTimeframe"],
  customRange: ["daily", "weekly", "fullTimeframe"],
}

export function getDefaultViewBy(tf: Timeframe, currentViewBy?: ViewBy): ViewBy {
  const valid = VALID_VIEW_BY[tf]
  if (currentViewBy && valid.includes(currentViewBy)) return currentViewBy
  if (tf === "last7Days") return "daily"
  if (tf === "last30Days" || tf === "monthToDate" || tf === "lastMonth") return "weekly"
  if (tf === "quarterToDate" || tf === "lastQuarter") return "monthly"
  if (tf === "yearToDate" || tf === "last12Months") return "monthly"
  return valid[0]
}

// ---------------------------------------------------------------------------
// Row mapping (relocated from App.tsx mapRowForTable)
// ---------------------------------------------------------------------------

function mapRowForTable(r: { label: string; budget: number | null; spend: number; committed: number; variance: number | null; childViewId: string | null; excluded: boolean; po: string | null; invoice: string | null; id: string; txnType?: "PO" | "INVOICE" | "PO_AND_INVOICE" | "MANUAL_ACCRUAL" | null }, censusDisplay: DbCensusDisplay | undefined): TableRow {
  return {
    name: r.label,
    budget: r.budget ?? 0,
    consumed: r.spend,
    committed: r.committed,
    variance: r.variance ?? (r.excluded ? -(r.spend) : 0),
    childViewId: r.childViewId,
    excluded: r.excluded,
    census: censusDisplay?.entries ?? [],
    po: r.po ?? null,
    invoice: r.invoice ?? null,
    txnType: r.txnType ?? null,
  }
}

// ---------------------------------------------------------------------------
// Data shaping pipeline (relocated from App.tsx displayData useMemo)
// ---------------------------------------------------------------------------

function applyDataShaping(baseRows: TableRow[], params: DataShapingParams): TableRow[] {
  // Step 1: Apply spend mode transformation
  const spendAdjusted = params.spendMode === "actual" ? baseRows : baseRows.map(row => {
    if (params.spendMode === "commitment") {
      const consumedDisplay = row.consumed * 1.1
      return {
        ...row,
        consumed: consumedDisplay,
        variance: row.budget - consumedDisplay,
      }
    }
    // totalImpact: actuals + open commitments
    const totalImpactSpend = row.consumed + (row.committed ?? 0)
    return {
      ...row,
      consumed: totalImpactSpend,
      variance: row.budget - totalImpactSpend,
    }
  })

  // Step 2: Apply timeframe multiplier
  const timeMultiplier = TIMEFRAME_MULTIPLIER[params.timeframe]
  const timeAdjusted = timeMultiplier === 1 ? spendAdjusted : spendAdjusted.map(row => ({
    ...row,
    budget: row.budget * timeMultiplier,
    consumed: row.consumed * timeMultiplier,
    variance: row.variance * timeMultiplier,
  }))

  // Step 3: Apply metric transformation (PPD divides by person-days, not a fixed constant)
  const metricAdjusted = params.metric === "dollars" ? timeAdjusted : timeAdjusted.map(row => {
    const pd = row._personDays
    if (!pd || pd <= 0) {
      return { ...row, budget: 0, consumed: 0, variance: 0, _ppdNull: true }
    }
    return {
      ...row,
      budget: row.budget / pd,
      consumed: row.consumed / pd,
      variance: row.variance / pd,
    }
  })

  // Step 4: Expand rows into period-stacked rows
  if (params.viewBy === "fullTimeframe") {
    return metricAdjusted
  }

  const periods = generatePeriodLabels(params.timeframe, params.viewBy)
  const periodCount = periods.length
  const expanded = metricAdjusted.flatMap((row, rowIdx) => {
    return periods.map((period, pIdx) => {
      const fraction = 1 / periodCount
      const seed = ((rowIdx * 7 + pIdx * 13) % 10) / 100
      const weight = fraction + (seed - 0.05) * fraction
      return {
        ...row,
        period,
        budget: Math.round(row.budget * weight),
        consumed: Math.round(row.consumed * weight),
        variance: Math.round(row.variance * weight),
      }
    })
  })

  return expanded
}

// ---------------------------------------------------------------------------
// Local Adapter Implementation
// ---------------------------------------------------------------------------

export class LocalAdapter implements ReportRepository {
  private viewCache = new Map<string, ReportView>()

  getView(viewId: string): ReportView | undefined {
    // Check cache first
    const cached = this.viewCache.get(viewId)
    if (cached) return cached

    // Find the view record
    const view = dbViews.find(v => v.id === viewId)
    if (!view) return undefined

    // Gather related database records
    const context = dbReportContexts.find(c => c.id === view.contextId)
    if (!context) return undefined

    const timeBuckets = dbTimeBuckets.filter(tb => tb.contextId === view.contextId)
    const breadcrumbs = dbBreadcrumbs.filter(b => b.viewId === viewId)
    const rows = dbRows.filter(r => r.viewId === viewId)
    const rowIds = new Set(rows.map(r => r.id))

    const rowTimeBuckets = dbRowTimeBuckets.filter(rtb => rowIds.has(rtb.rowId))
    const spendCompositions = dbSpendCompositions.filter(sc => rowIds.has(sc.rowId))
    const censusContexts = dbCensusContexts.filter(cc => rowIds.has(cc.rowId))
    const decompositions = dbDecompositions.filter(d => rowIds.has(d.rowId))
    const lineages = dbLineages.filter(l => rowIds.has(l.rowId))
    const aggregations = dbAggregations.filter(a => rowIds.has(a.rowId))
    const drills = dbDrills.filter(d => rowIds.has(d.rowId))
    const exclusions = dbExclusions.filter(e => rowIds.has(e.rowId))

    // Assemble through transformation layer
    const reportView = assembleReportView({
      view,
      context,
      meta: dbMeta,
      timeBuckets,
      breadcrumbs,
      rows,
      rowTimeBuckets,
      spendCompositions,
      censusContexts,
      decompositions,
      lineages,
      aggregations,
      drills,
      exclusions,
    })

    // Cache the result
    this.viewCache.set(viewId, reportView)
    return reportView
  }

  getProcessedData(viewId: string, params: DataShapingParams): ProcessedViewData {
    const view = this.getView(viewId)
    if (!view) {
      return {
        displayData: [],
        kpi: { budget: 0, consumed: 0, variance: 0, percent: 0, excludedSpend: 0, reconciliation: { rowCount: 0, includedRows: 0, excludedRows: 0, checksum: "chk-0-0" } },
        entityTypeLabel: "Unknown",
        breadcrumbPath: [],
        scopeLabel: "Unknown",
        isTransactionView: false,
        isVendorView: false,
        showPeriod: false,
      }
    }

    // Apply facility scope filter at root
    let rows = view.rows
    if (params.pivotBy === "facility" && viewId === params.rootViewId && params.facilityScope !== "all") {
      rows = rows.filter(r => r.label === params.facilityScope)
    }

    // Map to table rows with census display
    const baseRows = rows.map(r => {
      const censusDisplay = censusDisplayMap.get(r.id)
      return mapRowForTable(r, censusDisplay)
    })

    // Apply data shaping pipeline
    const displayData = applyDataShaping(baseRows, params)

    // Apply same metric/timeframe transforms to KPI values
    const timeMultiplier = TIMEFRAME_MULTIPLIER[params.timeframe]

    // Apply spend mode to KPI (same rules as rows)
    let kpiBaseConsumed = view.kpi.consumed
    if (params.spendMode === "commitment") {
      kpiBaseConsumed = view.kpi.consumed * 1.1
    } else if (params.spendMode === "totalImpact") {
      kpiBaseConsumed = view.kpi.consumed * 1.1
    }

    let kpiBudget: number, kpiConsumed: number, kpiVariance: number, kpiPercent: number
    if (params.metric === "ppd") {
      // PPD: sum person-days across all rows, divide totals
      const totalPD = baseRows.reduce((s, r) => s + (r._personDays ?? 0), 0)
      if (totalPD > 0) {
        kpiBudget = (view.kpi.budget * timeMultiplier) / totalPD
        kpiConsumed = (kpiBaseConsumed * timeMultiplier) / totalPD
        kpiVariance = kpiBudget - kpiConsumed
        kpiPercent = kpiBudget !== 0 ? (kpiVariance / kpiBudget) * 100 : 0
      } else {
        kpiBudget = 0; kpiConsumed = 0; kpiVariance = 0; kpiPercent = 0
      }
    } else {
      kpiBudget = view.kpi.budget * timeMultiplier
      kpiConsumed = kpiBaseConsumed * timeMultiplier
      kpiVariance = kpiBudget - kpiConsumed
      kpiPercent = kpiBudget !== 0 ? (kpiVariance / kpiBudget) * 100 : 0
    }

    return {
      displayData,
      kpi: { ...view.kpi, budget: kpiBudget, consumed: kpiConsumed, variance: kpiVariance, percent: kpiPercent },
      entityTypeLabel: view.entityTypeLabel,
      breadcrumbPath: view.breadcrumbPath,
      scopeLabel: view.scopeLabel,
      isTransactionView: view.entityTypeLabel === "Transactions",
      isVendorView: view.entityTypeLabel === "Vendors",
      showPeriod: params.viewBy !== "fullTimeframe",
    }
  }

  getFacilityNames(): string[] {
    return dbFacilities.map(f => f.name)
  }
}

// ---------------------------------------------------------------------------
// Adapter Registry — swappable active adapter. NO fallback to seed data.
// ---------------------------------------------------------------------------

// NullAdapter — returns empty data. Used as default until a real adapter connects.
// This ensures no fake/seed data ever renders if the real adapter fails to initialize.
class NullAdapter implements ReportRepository {
  getView(): ReportView | undefined { return undefined }
  getProcessedData(): ProcessedViewData {
    return {
      displayData: [],
      kpi: { budget: 0, consumed: 0, variance: 0, percent: 0, excludedSpend: 0, reconciliation: { rowCount: 0, includedRows: 0, excludedRows: 0, checksum: "null-0" } },
      entityTypeLabel: "",
      breadcrumbPath: [],
      scopeLabel: "",
      isTransactionView: false,
      isVendorView: false,
      showPeriod: false,
    }
  }
  getFacilityNames(): string[] { return [] }
}

let activeAdapter: ReportRepository = new NullAdapter()

export function setActiveAdapter(adapter: ReportRepository): void {
  activeAdapter = adapter
}

export function getActiveAdapter(): ReportRepository {
  return activeAdapter
}

export function getLocalAdapter(): LocalAdapter {
  return new LocalAdapter()
}

// ---------------------------------------------------------------------------
// Singleton repository — delegates to active adapter
// ---------------------------------------------------------------------------

export const repository: ReportRepository = {
  getView(viewId: string): ReportView | undefined {
    return activeAdapter.getView(viewId)
  },
  getProcessedData(viewId: string, params: DataShapingParams): ProcessedViewData {
    return activeAdapter.getProcessedData(viewId, params)
  },
  getFacilityNames(): string[] {
    return activeAdapter.getFacilityNames()
  },
}