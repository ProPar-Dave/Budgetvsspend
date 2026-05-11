/**
 * Supabase Adapter
 *
 * Implements ReportRepository using the Supabase-backed server API.
 * Stores database-shaped record bundles in KV via the server,
 * transforms them through the existing transformation layer on retrieval,
 * and applies the same data shaping pipeline as the LocalAdapter.
 *
 * Data flow:
 *   Supabase KV → server API → database-facing records
 *   → assembleReportView (transformation layer) → ReportView
 *   → mapRowForTable + applyDataShaping → ProcessedViewData → UI
 */

import { projectId, publicAnonKey } from "/utils/supabase/info"
import type { ReportView, ReportKpi, BreadcrumbSegment, ReportRow } from "./data-source"
import type { DbCensusDisplay } from "./db-types"
import type {
  ReportRepository, ProcessedViewData, DataShapingParams, TableRow,
  Timeframe, ViewBy,
} from "./repository"
import { generatePeriodLabels } from "./repository"
import { assembleReportView } from "./transform"
import type { DbViewData } from "./transform"

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b98afb97/report`

const headers = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${publicAnonKey}`,
})

// ---------------------------------------------------------------------------
// Shared data-shaping logic (same as repository.tsx — pure functions)
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

function mapRowForTable(
  r: ReportRow,
  censusDisplay: DbCensusDisplay | undefined
): TableRow {
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

function applyDataShaping(baseRows: TableRow[], params: DataShapingParams): TableRow[] {
  const spendAdjusted = params.spendMode === "actual" ? baseRows : baseRows.map(row => {
    if (params.spendMode === "commitment") {
      const consumedDisplay = row.consumed * 1.1
      return { ...row, consumed: consumedDisplay, variance: row.budget - consumedDisplay }
    }
    const totalImpactSpend = row.consumed + (row.committed ?? 0)
    return { ...row, consumed: totalImpactSpend, variance: row.budget - totalImpactSpend }
  })

  const timeMultiplier = TIMEFRAME_MULTIPLIER[params.timeframe]
  const timeAdjusted = timeMultiplier === 1 ? spendAdjusted : spendAdjusted.map(row => ({
    ...row,
    budget: row.budget * timeMultiplier,
    consumed: row.consumed * timeMultiplier,
    variance: row.variance * timeMultiplier,
  }))

  const metricAdjusted = params.metric === "dollars" ? timeAdjusted : timeAdjusted.map(row => ({
    ...row,
    budget: row.budget / 100,
    consumed: row.consumed / 100,
    variance: row.variance / 100,
  }))

  if (params.viewBy === "fullTimeframe") return metricAdjusted

  const periods = generatePeriodLabels(params.timeframe, params.viewBy)
  const periodCount = periods.length
  return metricAdjusted.flatMap((row, rowIdx) =>
    periods.map((period, pIdx) => {
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
  )
}

// ---------------------------------------------------------------------------
// SupabaseAdapter
// ---------------------------------------------------------------------------

export class SupabaseAdapter implements ReportRepository {
  private viewCache = new Map<string, ReportView>()
  private censusDisplays: Record<string, DbCensusDisplay> | null = null
  private facilityNamesCache: string[] | null = null

  async ensureCensusDisplays(): Promise<Record<string, DbCensusDisplay>> {
    if (this.censusDisplays) return this.censusDisplays
    try {
      const res = await fetch(`${BASE_URL}/census-displays`, { headers: headers() })
      if (res.ok) {
        this.censusDisplays = await res.json()
        return this.censusDisplays!
      }
    } catch (err) {
      console.log("Error fetching census displays from Supabase:", err)
    }
    this.censusDisplays = {}
    return this.censusDisplays
  }

  getView(viewId: string): ReportView | undefined {
    // Synchronous cache lookup only — for async fetching, use getViewAsync
    return this.viewCache.get(viewId)
  }

  async getViewAsync(viewId: string): Promise<ReportView | undefined> {
    const cached = this.viewCache.get(viewId)
    if (cached) return cached

    try {
      const res = await fetch(`${BASE_URL}/view/${viewId}`, { headers: headers() })
      if (!res.ok) {
        console.log(`View ${viewId} not found in Supabase (${res.status})`)
        return undefined
      }
      const dbViewData: DbViewData = await res.json()
      const reportView = assembleReportView(dbViewData)
      this.viewCache.set(viewId, reportView)
      return reportView
    } catch (err) {
      console.log(`Error fetching view ${viewId} from Supabase:`, err)
      return undefined
    }
  }

  /** Fetch and cache ALL views in one request */
  async preloadAllViews(): Promise<number> {
    try {
      const res = await fetch(`${BASE_URL}/views/all`, { headers: headers() })
      if (!res.ok) {
        console.log(`Failed to fetch all views (${res.status})`)
        return 0
      }
      const allViewData: Record<string, DbViewData> = await res.json()
      let count = 0
      for (const [viewId, dbViewData] of Object.entries(allViewData)) {
        const reportView = assembleReportView(dbViewData)
        this.viewCache.set(viewId, reportView)
        count++
      }
      console.log(`Preloaded ${count} views into SupabaseAdapter cache`)
      return count
    } catch (err) {
      console.log("Error preloading all views from Supabase:", err)
      return 0
    }
  }

  getProcessedData(viewId: string, params: DataShapingParams): ProcessedViewData {
    // Synchronous path using cache — view must be preloaded
    const view = this.viewCache.get(viewId)
    if (!view) {
      return {
        displayData: [],
        kpi: { budget: 0, consumed: 0, variance: 0, percent: 0, excludedSpend: 0, reconciliation: { rowCount: 0, includedRows: 0, excludedRows: 0, checksum: "chk-0-0" } },
        entityTypeLabel: "Unknown",
        breadcrumbPath: [],
        scopeLabel: "Unknown",
        isTransactionView: false,
        showPeriod: false,
      }
    }

    let rows = view.rows
    if (params.pivotBy === "facility" && viewId === params.rootViewId && params.facilityScope !== "all") {
      rows = rows.filter(r => r.label === params.facilityScope)
    }

    const censusMap = this.censusDisplays ?? {}
    const baseRows = rows.map(r => mapRowForTable(r, censusMap[r.id]))
    const displayData = applyDataShaping(baseRows, params)

    // Apply same metric/timeframe transforms to KPI values
    const timeMultiplier = TIMEFRAME_MULTIPLIER[params.timeframe]
    const metricDivisor = params.metric === "ppd" ? 100 : 1

    // Apply spend mode to KPI (same rules as rows)
    let kpiBaseConsumed = view.kpi.consumed
    if (params.spendMode === "commitment") {
      kpiBaseConsumed = view.kpi.consumed * 1.1
    } else if (params.spendMode === "totalImpact") {
      kpiBaseConsumed = view.kpi.consumed * 1.1
    }

    const kpiBudget = view.kpi.budget * timeMultiplier / metricDivisor
    const kpiConsumed = kpiBaseConsumed * timeMultiplier / metricDivisor
    const kpiVariance = kpiBudget - kpiConsumed
    const kpiPercent = kpiBudget !== 0 ? Math.round((kpiVariance / kpiBudget) * 100) : 0

    return {
      displayData,
      kpi: { ...view.kpi, budget: kpiBudget, consumed: kpiConsumed, variance: kpiVariance, percent: kpiPercent },
      entityTypeLabel: view.entityTypeLabel,
      breadcrumbPath: view.breadcrumbPath,
      scopeLabel: view.scopeLabel,
      isTransactionView: view.entityTypeLabel === "Transactions",
      showPeriod: params.viewBy !== "fullTimeframe",
    }
  }

  getFacilityNames(): string[] {
    return this.facilityNamesCache ?? []
  }

  async fetchFacilityNames(): Promise<string[]> {
    if (this.facilityNamesCache) return this.facilityNamesCache
    try {
      const res = await fetch(`${BASE_URL}/facility-names`, { headers: headers() })
      if (res.ok) {
        this.facilityNamesCache = await res.json()
        return this.facilityNamesCache!
      }
    } catch (err) {
      console.log("Error fetching facility names from Supabase:", err)
    }
    return []
  }
}

// ---------------------------------------------------------------------------
// Seed function — sends local Db* data to the server for KV storage
// ---------------------------------------------------------------------------

export async function seedSupabase(): Promise<boolean> {
  try {
    // Check if already seeded
    const statusRes = await fetch(`${BASE_URL}/seed-status`, { headers: headers() })
    if (statusRes.ok) {
      const status = await statusRes.json()
      if (status.seeded && status.viewCount > 0 && status.version === "v8-excluded-spend-separation") {
        console.log(`Supabase already seeded with ${status.viewCount} views (v8-excluded-spend-separation)`)
        return true
      }
    }

    // Import seed data dynamically to build DbViewData bundles
    const {
      dbViews, dbReportContexts, dbMeta, dbTimeBuckets,
      dbBreadcrumbs, dbRows, dbRowTimeBuckets, dbSpendCompositions,
      dbCensusContexts, dbDecompositions, dbLineages, dbAggregations,
      dbDrills, dbExclusions, dbFacilities, censusDisplayMap,
    } = await import("./db-seed")

    // Build view bundles keyed by viewId
    const views: Record<string, DbViewData> = {}
    for (const view of dbViews) {
      const context = dbReportContexts.find(c => c.id === view.contextId)
      if (!context) continue

      const timeBuckets = dbTimeBuckets.filter(tb => tb.contextId === view.contextId)
      const breadcrumbs = dbBreadcrumbs.filter(b => b.viewId === view.id)
      const rows = dbRows.filter(r => r.viewId === view.id)
      const rowIds = new Set(rows.map(r => r.id))

      views[view.id] = {
        view,
        context,
        meta: dbMeta,
        timeBuckets,
        breadcrumbs,
        rows,
        rowTimeBuckets: dbRowTimeBuckets.filter(rtb => rowIds.has(rtb.rowId)),
        spendCompositions: dbSpendCompositions.filter(sc => rowIds.has(sc.rowId)),
        censusContexts: dbCensusContexts.filter(cc => rowIds.has(cc.rowId)),
        decompositions: dbDecompositions.filter(d => rowIds.has(d.rowId)),
        lineages: dbLineages.filter(l => rowIds.has(l.rowId)),
        aggregations: dbAggregations.filter(a => rowIds.has(a.rowId)),
        drills: dbDrills.filter(d => rowIds.has(d.rowId)),
        exclusions: dbExclusions.filter(e => rowIds.has(e.rowId)),
      }
    }

    // Build census display map as plain object
    const censusDisplays: Record<string, any> = {}
    censusDisplayMap.forEach((val, key) => {
      censusDisplays[key] = val
    })

    const facilityNames = dbFacilities.map(f => f.name)

    // Send to server
    const seedRes = await fetch(`${BASE_URL}/seed`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ views, facilityNames, censusDisplays }),
    })

    if (seedRes.ok) {
      const result = await seedRes.json()
      console.log(`Supabase seeded successfully: ${result.viewCount} views`)
      return true
    } else {
      const err = await seedRes.text()
      console.log(`Supabase seed failed: ${err}`)
      return false
    }
  } catch (err) {
    console.log("Error seeding Supabase:", err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Preload all views into the SupabaseAdapter cache
// ---------------------------------------------------------------------------

export async function preloadSupabaseAdapter(adapter: SupabaseAdapter): Promise<boolean> {
  try {
    // Fetch facility names, census displays, and ALL views in parallel
    const [, , viewCount] = await Promise.all([
      adapter.fetchFacilityNames(),
      adapter.ensureCensusDisplays(),
      adapter.preloadAllViews(),
    ])

    if (viewCount === 0) {
      console.log("SupabaseAdapter: no views loaded")
      return false
    }

    console.log(`SupabaseAdapter fully loaded with ${viewCount} views`)
    return true
  } catch (err) {
    console.log("Error preloading SupabaseAdapter:", err)
    return false
  }
}