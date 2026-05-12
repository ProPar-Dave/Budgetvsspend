/**
 * BVS Adapter
 *
 * Implements ReportRepository using live BVS Postgres data via the
 * /bvs/report/* server routes. Views are fetched on-demand (with caching)
 * rather than preloaded, since they are dynamically aggregated from ~1.36M
 * transaction rows.
 *
 * Plugs into the same adapter registry as LocalAdapter / SupabaseAdapter.
 */

import { projectId, publicAnonKey } from "/utils/supabase/info"
import type { ReportView, ReportKpi, ReportRow } from "./data-source"
import type {
  ReportRepository, ProcessedViewData, DataShapingParams, TableRow,
  Timeframe, ViewBy, SpendMode,
} from "./repository"
import { generatePeriodLabels } from "./repository"
import { getTimeframeRange } from "./timeframe-utils"
import { assembleReportView } from "./transform"
import type { DbViewData } from "./transform"

const BVS_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b98afb97/bvs/report`

// Phase 4 — engine endpoint base + reversibility flag.
// Engine routes live under /bvs/drill (rows) and /bvs/drill/periods (period breakdowns).
// USE_ENGINE = true routes all drill traffic through the engine; flipping to false
// reverts to the per-path /bvs/report/* endpoints in a single line. Cache keys
// carry an "eng"|"leg" suffix so toggling the flag never surfaces stale entries
// from the other path.
const BVS_ENGINE_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b98afb97/bvs`
const USE_ENGINE = true

const hdrs = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${publicAnonKey}`,
})

// ---------------------------------------------------------------------------
// Phase 4 — viewId → engine drill (path + filterStack) translation
// ---------------------------------------------------------------------------
//
// The adapter receives two viewId formats from callers:
//
//   1. Bootstrap roots: "bvs-fac-root", "bvs-gl-root", "bvs-vendor-root"
//      Hardcoded in BVS_ROOT_VIEW. The App passes these at startup.
//
//   2. Engine-native drill targets: "drill:facility.gl?facility_id=X"
//      What the engine emits as childViewId in row payloads. The UI carries
//      these forward when the user drills.
//
// translateViewIdToDrill normalizes both into { path, filterStack } that
// buildEngineUrl assembles into a /bvs/drill or /bvs/drill/periods URL.
// Throws on unrecognized formats (caller logs and returns undefined).

type DrillRequest = { path: string; filterStack: Array<{ column: string; value: string }> }

function translateViewIdToDrill(viewId: string): DrillRequest {
  // Bootstrap roots
  if (viewId === "bvs-fac-root") return { path: "facility", filterStack: [] }
  if (viewId === "bvs-gl-root") return { path: "gl", filterStack: [] }
  if (viewId === "bvs-vendor-root") return { path: "vendor", filterStack: [] }

  // Engine-native drill viewIds — "drill:{path}?{col}={val}&{col}={val}"
  if (viewId.startsWith("drill:")) {
    const rest = viewId.slice("drill:".length)
    const qIdx = rest.indexOf("?")
    if (qIdx === -1) return { path: rest, filterStack: [] }
    const path = rest.slice(0, qIdx)
    const qs = rest.slice(qIdx + 1)
    const filterStack: Array<{ column: string; value: string }> = []
    for (const pair of qs.split("&")) {
      if (!pair) continue
      const eqIdx = pair.indexOf("=")
      if (eqIdx === -1) continue
      const column = decodeURIComponent(pair.slice(0, eqIdx))
      const value = decodeURIComponent(pair.slice(eqIdx + 1))
      filterStack.push({ column, value })
    }
    return { path, filterStack }
  }

  throw new Error(`[bvs-adapter] Unrecognized viewId format for engine routing: ${viewId}`)
}

function buildEngineUrl(
  viewId: string,
  spendMode: SpendMode,
  startDate: string | null,
  endDate: string | null,
): string {
  const drill = translateViewIdToDrill(viewId)
  const filterParams = drill.filterStack
    .map(f => `&filter[${encodeURIComponent(f.column)}]=${encodeURIComponent(f.value)}`)
    .join("")
  const rangeParams = (startDate && endDate)
    ? `&start=${startDate}&end=${endDate}`
    : ""
  return `${BVS_ENGINE_BASE}/drill?path=${drill.path}${filterParams}&spendMode=${spendMode}${rangeParams}`
}

function buildEnginePeriodsUrl(
  viewId: string,
  viewBy: string,
  spendMode: SpendMode,
  startDate: string | null,
  endDate: string | null,
): string {
  const drill = translateViewIdToDrill(viewId)
  const filterParams = drill.filterStack
    .map(f => `&filter[${encodeURIComponent(f.column)}]=${encodeURIComponent(f.value)}`)
    .join("")
  const rangeParams = (startDate && endDate)
    ? `&start=${startDate}&end=${endDate}`
    : ""
  return `${BVS_ENGINE_BASE}/drill/periods?path=${drill.path}${filterParams}&viewBy=${viewBy}&spendMode=${spendMode}${rangeParams}`
}

// ---------------------------------------------------------------------------
// Data shaping (same as repository.tsx / supabase-adapter.tsx)
// ---------------------------------------------------------------------------

const TIMEFRAME_MULTIPLIER: Record<Timeframe, number> = {
  last7Days: 0.25, last30Days: 1.0, monthToDate: 1.0, lastMonth: 1.25,
  quarterToDate: 3.0, lastQuarter: 3.0, yearToDate: 12.0, last12Months: 12.0,
  customRange: 1.0,
}

function mapRow(r: ReportRow, entityType: string, index: number): TableRow {
  // Map server status string to the wire-format status for display-only mapping
  const serverStatus = r.status
  const wireStatus: TableRow["_status"] =
    serverStatus === "Over Budget" ? "over_budget"
    : serverStatus === "On Track" ? "on_track"
    : serverStatus === "Under Budget" ? "under_budget"
    : "excluded"

  return {
    name: r.label,
    budget: r.budget ?? 0,
    consumed: r.spend,
    committed: r.committed,
    variance: r.excluded ? 0 : (r.variance ?? 0),
    childViewId: r.childViewId,
    excluded: r.excluded,
    census: [],
    po: r.po ?? null,
    invoice: r.invoice ?? null,
    txnType: r.txnType ?? null,
    _status: wireStatus,
    variancePercent: r.variancePercent,
  }
}

// Monthly person-days map: "YYYY-MM" → person-days for that month
type MonthlyPdMap = Record<string, number>

/**
 * Compute timeframe-scoped person-days from monthly breakdown.
 * This ensures PPD denominators match the selected timeframe, not the full year.
 */
function scopePersonDays(monthlyPd: MonthlyPdMap | undefined, timeframe: Timeframe, anchorDate: Date | null): number {
  if (!monthlyPd || Object.keys(monthlyPd).length === 0) return 0
  const anchor = anchorDate ?? new Date()
  const months = getTimeframeMonths(timeframe, anchor)
  if (months.length === 0) {
    // Fallback: sum all available months
    return Object.values(monthlyPd).reduce((a, b) => a + b, 0)
  }
  return months.reduce((sum, m) => sum + (monthlyPd[m] ?? 0), 0)
}

/**
 * Resolve the PPD denominator (person-days) for a row or KPI.
 * Centralised helper used by ALL PPD code paths — row-level, period-data, and KPI.
 * Any new drill level or view type automatically gets correct PPD handling by
 * calling this single function.
 *
 * Resolution order:
 *   1. Timeframe-scoped sum from monthlyPersonDays (if the map has entries)
 *   2. Fallback: legacy totalPersonDays scalar (pre-monthly-granularity compat)
 *   3. Returns 0 → caller should treat as "no census → show --"
 *
 * NOTE: Do NOT fall back to summing ALL months when the scoped lookup misses.
 * That fallback caused a critical bug where MTD PPD denominators jumped to the
 * full 28-month census table sum (~28× too large) when anchor year ≠ data year.
 * Better to display "--" than wildly inflated PPD numbers.
 */
function resolvePersonDays(
  monthlyPd: MonthlyPdMap | undefined,
  totalPd: number | null | undefined,
  timeframe: Timeframe,
  anchorDate: Date | null,
): number {
  const hasMonthly = monthlyPd && Object.keys(monthlyPd).length > 0
  if (hasMonthly) {
    const scoped = scopePersonDays(monthlyPd, timeframe, anchorDate)
    if (scoped > 0) return scoped
  }
  return totalPd ?? 0
}

/** Return array of "YYYY-MM" keys that fall within the given timeframe relative to anchor */
function getTimeframeMonths(timeframe: Timeframe, anchor: Date): string[] {
  const y = anchor.getFullYear()
  const m = anchor.getMonth() // 0-based

  const fmt = (yr: number, mo: number) => `${yr}-${String(mo + 1).padStart(2, "0")}`

  switch (timeframe) {
    case "monthToDate":
      return [fmt(y, m)]
    case "lastMonth": {
      const d = new Date(y, m - 1, 1)
      return [fmt(d.getFullYear(), d.getMonth())]
    }
    case "last30Days":
      // Current + previous month (may span two)
      return m > 0 ? [fmt(y, m - 1), fmt(y, m)] : [fmt(y - 1, 11), fmt(y, m)]
    case "last7Days":
      return [fmt(y, m)] // almost always within current month
    case "quarterToDate": {
      const qStart = Math.floor(m / 3) * 3
      const months: string[] = []
      for (let i = qStart; i <= m; i++) months.push(fmt(y, i))
      return months
    }
    case "lastQuarter": {
      const curQStart = Math.floor(m / 3) * 3
      const prevQStart = curQStart - 3
      const months: string[] = []
      for (let i = 0; i < 3; i++) {
        const mi = prevQStart + i
        if (mi >= 0) months.push(fmt(y, mi))
        else months.push(fmt(y - 1, 12 + mi))
      }
      return months
    }
    case "yearToDate": {
      const months: string[] = []
      for (let i = 0; i <= m; i++) months.push(fmt(y, i))
      return months
    }
    case "last12Months": {
      const months: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(y, m - i, 1)
        months.push(fmt(d.getFullYear(), d.getMonth()))
      }
      return months
    }
    default:
      return [] // customRange — fall back to full sum
  }
}

// Extended row type that carries entityId for period matching.
// Ship 4b: also carries v2-enriched server PPD values when present.
// Round 3: _personDaysByType for multi-type CCRC Census column rendering.
// Round 4b: GL applicability contract — engine emits per-row applicability
// metadata when GL is in scope (groupBy=gl OR gl filter). _personDaysByType
// remains the FULL scoped breakdown (not pre-filtered) so the UI can derive
// the filtered view and explain excluded types in tooltips/debug.
type TableRowWithEntity = TableRow & {
  _entityId: string
  _personDays?: number | null
  _personDaysByType?: Record<string, number> | null
  _monthlyPersonDays?: MonthlyPdMap
  // Ship 4b: server-computed PPD (v2 enriched only; undefined on legacy)
  _spendPPD?: number | null
  _budgetPPD?: number | null
  _variancePPD?: number | null
  // Round 4b: GL applicability contract (Path B math-aware mode)
  _applicableCensusTypes?: string[] | null
  _nonApplicablePersonDays?: number
  _ppdCalculationBasis?: "full_scope" | "gl_applicability"
}

function mapRowWithEntity(r: ReportRow, entityType: string, index: number): TableRowWithEntity {
  return {
    ...mapRow(r, entityType, index),
    _entityId: r.entityId,
    txnCount: r.txnCount,
    avgTransaction: r.avgTransaction,
    lastTxnDate: r.lastTxnDate,
    facilityType: r.facilityType,
    censusValue: r.censusValue,
    censusBasis: r.censusBasis,
    _personDays: r.personDays ?? null,
    _personDaysByType: (r as any).personDaysByType ?? null,
    _monthlyPersonDays: r.monthlyPersonDays ?? undefined,
    // Ship 4b: pass through server-computed PPD if present
    _spendPPD: r.spendPPD,
    _budgetPPD: r.budgetPPD,
    _variancePPD: r.variancePPD,
    // Round 4b: explicit pass-through for GL applicability contract.
    // Engine emits these as `_applicableCensusTypes`/`_nonApplicablePersonDays`/
    // `_ppdCalculationBasis` (with underscores already). transformRow's ...db
    // spread carries them through; we forward explicitly for type-safety and to
    // make the contract visible at this seam.
    _applicableCensusTypes: (r as any)._applicableCensusTypes ?? null,
    _nonApplicablePersonDays: (r as any)._nonApplicablePersonDays ?? 0,
    _ppdCalculationBasis: (r as any)._ppdCalculationBasis ?? undefined,
  }
}

// Period data shape returned from server
// Period data shape returned from server.
// Ship 4c: buckets may carry server-computed PPD (spendPPD/budgetPPD/variancePPD)
// when the response is enriched. Legacy buckets omit those fields and the client
// falls back to division. PPD values may be null (server signals "no census" for
// the period — render as "--").
type PeriodBucket = {
  spend: number
  budget: number
  committed: number
  spendPPD?: number | null
  budgetPPD?: number | null
  variancePPD?: number | null
}
type PeriodMap = Record<string, Record<string, PeriodBucket>>

// Sparkline data shape returned from server
export type SparklinePoint = { month: string; spend: number | null; budget: number }
export type SparklineMap = Record<string, SparklinePoint[]>

function applyDataShaping(baseRows: TableRowWithEntity[], params: DataShapingParams, periodData?: PeriodMap, anchorDate?: Date | null, isEnriched?: boolean): TableRow[] {
  // Spend mode is now applied server-side — no client-side adjustment needed
  const spendAdjusted = baseRows

  // Ship 4b: in v2 enriched mode the server has already scoped spend to the
  // requested start/end window. The TIMEFRAME_MULTIPLIER scalar would
  // double-scale the numbers. Skip it.
  const tm = isEnriched ? 1 : TIMEFRAME_MULTIPLIER[params.timeframe]
  const timeAdj = tm === 1 ? spendAdjusted : spendAdjusted.map(r => ({
    ...r, budget: r.budget * tm, consumed: r.consumed * tm, variance: r.variance * tm,
  }))

  // PPD: divide dollar values by timeframe-scoped person-days (from census_daily)
  // If personDays is 0 or null, set values to null (display as "--")
  // Ship 4b: in v2 mode, read PPD straight off row payload — no division.
  const metricAdj = params.metric === "dollars" ? timeAdj : timeAdj.map(r => {
    if (isEnriched) {
      // Server-computed PPD. null means "no census" — render as "--".
      if (r._spendPPD == null && r._budgetPPD == null) {
        return { ...r, budget: 0, consumed: 0, variance: 0, _ppdNull: true }
      }
      return {
        ...r,
        budget: r._budgetPPD ?? 0,
        consumed: r._spendPPD ?? 0,
        variance: r._variancePPD ?? 0,
      }
    }
    // Legacy: client-side PPD division
    const pd = resolvePersonDays(r._monthlyPersonDays, r._personDays, params.timeframe, anchorDate ?? null)
    if (!pd || pd <= 0) {
      return { ...r, budget: 0, consumed: 0, variance: 0, _ppdNull: true }
    }
    return {
      ...r,
      budget: r.budget / pd,
      consumed: r.consumed / pd,
      variance: r.variance / pd,
    }
  })

  if (params.viewBy === "fullTimeframe") return metricAdj

  // Ship 4c: thread the data anchor through so period labels match server bucket keys.
  // Without this, FALLBACK_ANCHOR (2025-12-28) drives label generation and every
  // bucket lookup misses against 2026-keyed server responses.
  const periods = generatePeriodLabels(params.timeframe, params.viewBy, anchorDate ?? undefined)

  // If we have real per-period data from the server, use it
  if (periodData && Object.keys(periodData).length > 0) {
    return metricAdj.flatMap((row) => {
      const entityPeriods = periodData[row._entityId]
      return periods.map((period) => {
        if (entityPeriods && entityPeriods[period]) {
          const pd = entityPeriods[period]
          const spend = pd.spend
          const budget = pd.budget
          const committed = pd.committed
          // Spend mode already applied server-side in period data
          const variance = budget - spend
          // Per-period variance % and status — MUST be recomputed from this period's
          // budget/spend, not inherited from the parent row's full-timeframe aggregate.
          // % is unit-independent, so we compute from dollar values even in PPD mode.
          const periodVarPct = budget === 0 ? null : (variance / budget) * 100
          const periodStatus: TableRow["_status"] =
            periodVarPct === null ? "excluded"
            : periodVarPct < -5 ? "over_budget"
            : periodVarPct > 5 ? "under_budget"
            : "on_track"
          // Apply metric adjustment — PPD divides by timeframe-scoped person-days
          // Ship 4c: prefer server-computed per-period PPD (V3 doctrine). The
          // bucket carries spendPPD/budgetPPD/variancePPD when isEnriched=true
          // on the server; otherwise we fall back to the legacy division path.
          // Per-bucket detection (vs response-shape detection) handles mixed
          // deployment states gracefully.
          if (params.metric === "ppd") {
            const bucketHasPPD = "spendPPD" in pd
            if (bucketHasPPD) {
              // Server already computed PPD with the per-period denominator.
              // null PPD means "no census for this period" — render as "--".
              if (pd.spendPPD == null && pd.budgetPPD == null) {
                return { ...row, period, budget: 0, consumed: 0, committed: 0, variance: 0, variancePercent: periodVarPct, _status: periodStatus, _ppdNull: true }
              }
              return {
                ...row,
                period,
                budget: pd.budgetPPD ?? 0,
                consumed: pd.spendPPD ?? 0,
                // committed has no per-period PPD on the wire (out of scope for 4c) —
                // for the rare period-with-committed display, fall back to the
                // entity-grain personDays division so we don't show a missing value.
                committed: (() => {
                  const fallbackPd = resolvePersonDays(row._monthlyPersonDays, row._personDays, params.timeframe, anchorDate ?? null)
                  return fallbackPd && fallbackPd > 0 ? committed / fallbackPd : 0
                })(),
                variance: pd.variancePPD ?? 0,
                variancePercent: periodVarPct,
                _status: periodStatus,
              }
            }
            // Legacy fallback: divide by the row's full-timeframe person-days.
            // This is doctrinally weaker than per-period PD but matches pre-4c
            // behavior when the server hasn't been upgraded.
            const personDays = resolvePersonDays(row._monthlyPersonDays, row._personDays, params.timeframe, anchorDate ?? null)
            if (!personDays || personDays <= 0) {
              return { ...row, period, budget: 0, consumed: 0, committed: 0, variance: 0, variancePercent: periodVarPct, _status: periodStatus, _ppdNull: true }
            }
            return {
              ...row,
              period,
              budget: budget / personDays,
              consumed: spend / personDays,
              committed: committed / personDays,
              variance: variance / personDays,
              variancePercent: periodVarPct,
              _status: periodStatus,
            }
          }
          return {
            ...row,
            period,
            budget,
            consumed: spend,
            committed,
            variance,
            variancePercent: periodVarPct,
            _status: periodStatus,
          }
        }
        // No data for this entity/period — zero row
        return { ...row, period, budget: 0, consumed: 0, committed: 0, variance: 0, variancePercent: null, _status: "excluded" as TableRow["_status"] }
      })
    })
  }

  // Fallback: synthetic split (used while period data is loading)
  const pc = periods.length
  return metricAdj.flatMap((row, ri) =>
    periods.map((period, pi) => {
      const f = 1 / pc
      const seed = ((ri * 7 + pi * 13) % 10) / 100
      const w = f + (seed - 0.05) * f
      return { ...row, period, budget: Math.round(row.budget * w), consumed: Math.round(row.consumed * w), variance: Math.round(row.variance * w) }
    })
  )
}

// ---------------------------------------------------------------------------
// BVS root view IDs — these map from the app's PIVOT_ROOT_VIEW to BVS IDs
// ---------------------------------------------------------------------------

export const BVS_ROOT_VIEW: Record<string, string> = {
  facility: "bvs-fac-root",
  glAccount: "bvs-gl-root",
  vendor: "bvs-vendor-root",
}

// ---------------------------------------------------------------------------
// BvsAdapter
// ---------------------------------------------------------------------------

export class BvsAdapter implements ReportRepository {
  private viewCache = new Map<string, ReportView>()
  private facilityNamesCache: string[] | null = null
  private pendingFetches = new Map<string, Promise<ReportView | undefined>>()
  private periodDataCache = new Map<string, PeriodMap>()
  private pendingPeriodFetches = new Map<string, Promise<PeriodMap | null>>()
  private sparklineCache = new Map<string, SparklineMap>()
  public lastError: string | null = null
  public anchorDate: Date | null = null
  private _spendMode: SpendMode = "totalImpact"

  // Ship 4b: timeframe-aware fetch state.
  // When _startDate + _endDate are set, fetches go to the v2 enriched path
  // (server returns spendPPD/budgetPPD/variancePPD; client skips own math).
  // When unset, fetches use the legacy path (server defaults to anchor year,
  // client does timeframe scalar + PPD division as before).
  private _startDate: string | null = null
  private _endDate: string | null = null
  // Tracks whether the last fetched view came back with v2-enriched payload.
  // Drives the v2 vs legacy branching in applyDataShaping/getProcessedData.
  private _viewShapes = new Map<string, "v2" | "legacy">()

  // Phase 4b QA #3 defensive guard — tracks cache keys that have already
  // been retried once due to anomalous 1-row root response. Prevents an
  // infinite retry loop if the underlying race produces 1-row results
  // consistently for some viewId (e.g. a legitimate tenant with one
  // facility). Cleared whenever caches are invalidated (spend mode or
  // timeframe change) so the guard re-arms on the next legitimate boot.
  private _anomalyRetried = new Set<string>()

  /** Current spend mode — used for cache keying and server requests */
  get spendMode(): SpendMode { return this._spendMode }

  /** Set spend mode and invalidate caches so views are re-fetched with the new mode */
  setSpendMode(sm: SpendMode): boolean {
    if (sm === this._spendMode) return false
    this._spendMode = sm
    // Invalidate all view and period caches — they were fetched with the old spend mode
    this.viewCache.clear()
    this.periodDataCache.clear()
    this.sparklineCache.clear()
    this.pendingFetches.clear()
    this.pendingPeriodFetches.clear()
    this._viewShapes.clear()
    this._anomalyRetried.clear()
    console.log(`BVS: spend mode changed to ${sm} — caches invalidated`)
    return true
  }

  /**
   * Ship 4b: Set the active timeframe window. When set, all subsequent
   * fetchView/fetchPeriodData calls include start/end query params and
   * receive v2-enriched payloads (with spendPPD/budgetPPD/variancePPD).
   *
   * Returns true if the range changed (caller should refetch the active view).
   * Cache is invalidated on change because the cache key includes the range.
   *
   * Pass (null, null) to disable v2 mode and revert to legacy fetches.
   */
  setTimeframeRange(start: string | null, end: string | null): boolean {
    if (start === this._startDate && end === this._endDate) return false
    this._startDate = start
    this._endDate = end
    // Invalidate everything — cache keys depend on the range
    this.viewCache.clear()
    this.periodDataCache.clear()
    this.sparklineCache.clear()
    this.pendingFetches.clear()
    this.pendingPeriodFetches.clear()
    this._viewShapes.clear()
    this._anomalyRetried.clear()
    console.log(`BVS: timeframe range changed to ${start ?? "(none)"}..${end ?? "(none)"} — caches invalidated`)
    return true
  }

  /** Current active timeframe range (null,null if not in v2 mode). */
  getActiveTimeframeRange(): { start: string | null; end: string | null } {
    return { start: this._startDate, end: this._endDate }
  }

  /** True when the last fetch for this viewId returned v2-enriched payload. */
  isViewEnriched(viewId: string): boolean {
    return this._viewShapes.get(viewId) === "v2"
  }

  /**
   * Ship 4b: build the cache key. When in v2 mode (range set), the key
   * includes start/end so different timeframes are cached independently.
   * Pre-4b mode (no range) uses just viewId — preserves existing behavior.
   */
  private _cacheKey(viewId: string): string {
    // Phase 4: suffix prevents stale entries from the other path when USE_ENGINE
    // is toggled (e.g. for revert validation).
    const suffix = USE_ENGINE ? "eng" : "leg"
    if (this._startDate && this._endDate) {
      return `${viewId}|${this._startDate}|${this._endDate}|${suffix}`
    }
    return `${viewId}|${suffix}`
  }

  getView(viewId: string): ReportView | undefined {
    return this.viewCache.get(this._cacheKey(viewId))
  }

  async fetchView(viewId: string): Promise<ReportView | undefined> {
    const cacheKey = this._cacheKey(viewId)
    const cached = this.viewCache.get(cacheKey)
    if (cached) return cached

    // Deduplicate concurrent fetches
    const pending = this.pendingFetches.get(cacheKey)
    if (pending) return pending

    const promise = (async () => {
      try {
        console.log(`BVS: fetching view ${viewId} (spendMode=${this._spendMode}, range=${this._startDate ?? "anchor"}..${this._endDate ?? "anchor"})`)
        // Retry logic: attempt up to 2 times (initial + 1 retry) for transient failures
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 55000)
            // Ship 4b: append start/end when set — server returns v2 enriched payload
            const rangeParams = (this._startDate && this._endDate)
              ? `&start=${this._startDate}&end=${this._endDate}`
              : ""
            // Phase 4: route through engine endpoint when USE_ENGINE is true.
            // Engine handles all 12 valid drill paths via the planner; legacy
            // per-path endpoints serve as the revert path.
            const url = USE_ENGINE
              ? buildEngineUrl(viewId, this._spendMode, this._startDate, this._endDate)
              : `${BVS_BASE}/view/${viewId}?spendMode=${this._spendMode}${rangeParams}`
            const res = await fetch(url, { headers: hdrs(), signal: controller.signal })
            clearTimeout(timeout)
            if (!res.ok) {
              const txt = await res.text()
              console.log(`BVS fetch view ${viewId} attempt ${attempt + 1} failed (${res.status}): ${txt}`)
              this.lastError = `HTTP ${res.status}: ${txt.slice(0, 200)}`
              if (attempt === 0 && (res.status >= 500 || res.status === 0)) {
                console.log(`BVS: retrying ${viewId} after server error...`)
                await new Promise(r => setTimeout(r, 1000))
                continue
              }
              return undefined
            }
            // Ship 4b: detect v2 enriched payload via response header
            const shape = res.headers.get("X-BVS-Response-Shape") === "v2" ? "v2" : "legacy"
            this._viewShapes.set(cacheKey, shape)
            const dbViewData: DbViewData = await res.json()
            // Extract inline sparkline data from rows before transform
            this._extractInlineSparklines(viewId, dbViewData)
            const reportView = assembleReportView(dbViewData)
            // Phase 4b QA #3 defensive guard — a root view (facility / GL /
            // vendor root) should never return exactly 1 row in any legitimate
            // dataset Procurement Partners ships. If we see that pattern, log
            // a warning and refetch once. Some intermittent boot race produces
            // this state where the response carries a single entity's totals
            // as if it were the portfolio; the underlying cause has resisted
            // reproduction. _anomalyRetried is a per-cacheKey one-shot, so we
            // never loop more than once even if the retry returns the same
            // anomalous shape (we cache and accept it on the second pass to
            // avoid blocking a tenant that legitimately has one facility).
            const isRootView = viewId === "bvs-fac-root"
              || viewId === "bvs-gl-root"
              || viewId === "bvs-vendor-root"
            if (
              attempt === 0
              && isRootView
              && reportView.rows.length === 1
              && !this._anomalyRetried.has(cacheKey)
            ) {
              console.warn(
                `BVS: anomalous 1-row response for root view ${viewId} `
                + `(row label="${reportView.rows[0]?.label ?? "?"}", `
                + `consumed=${reportView.kpi?.consumed ?? "?"}) — refetching once`
              )
              this._anomalyRetried.add(cacheKey)
              // Small delay to let any racing state settle before retry.
              await new Promise(r => setTimeout(r, 250))
              continue
            }
            this.viewCache.set(cacheKey, reportView)
            console.log(`BVS: view ${viewId} cached (${reportView.rows.length} rows, shape=${shape})`)
            return reportView
          } catch (innerErr: any) {
            console.log(`BVS fetch view ${viewId} attempt ${attempt + 1} error:`, innerErr?.message ?? innerErr)
            this.lastError = `Network error: ${innerErr?.message ?? innerErr}`
            if (attempt === 0) {
              console.log(`BVS: retrying ${viewId} after error...`)
              await new Promise(r => setTimeout(r, 1000))
              continue
            }
            return undefined
          }
        }
        return undefined
      } finally {
        this.pendingFetches.delete(cacheKey)
      }
    })()

    this.pendingFetches.set(cacheKey, promise)
    return promise
  }

  /** Preload a single root view by viewId */
  async preloadRoot(viewId: string): Promise<boolean> {
    if (this.viewCache.has(this._cacheKey(viewId))) return true
    const view = await this.fetchView(viewId)
    return !!view
  }

  /** Preload the three root views (used for bulk preload if desired) */
  async preloadRoots(): Promise<number> {
    // Phase 4: engine has no bulk roots endpoint — fan out 3 parallel
    // preloadRoot calls. Each goes through fetchView → buildEngineUrl.
    if (USE_ENGINE) {
      try {
        const results = await Promise.all([
          this.preloadRoot("bvs-fac-root"),
          this.preloadRoot("bvs-gl-root"),
          this.preloadRoot("bvs-vendor-root"),
        ])
        const count = results.filter(Boolean).length
        console.log(`BVS preloaded ${count} root views (engine, parallel)`)
        return count
      } catch (err) {
        console.log("BVS preload roots error (engine):", err)
        return 0
      }
    }
    // Legacy bulk path — preserved for revert (USE_ENGINE = false).
    try {
      // Ship 4b: append start/end when set — server returns v2 enriched roots
      const rangeParams = (this._startDate && this._endDate)
        ? `?spendMode=${this._spendMode}&start=${this._startDate}&end=${this._endDate}`
        : `?spendMode=${this._spendMode}`
      console.log(`BVS: fetching roots from ${BVS_BASE}/roots${rangeParams}`)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(`${BVS_BASE}/roots${rangeParams}`, { headers: hdrs(), signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) {
        const errText = await res.text()
        console.log(`BVS roots fetch failed (${res.status}): ${errText}`)
        return 0
      }
      const shape = res.headers.get("X-BVS-Response-Shape") === "v2" ? "v2" : "legacy"
      const rootData: Record<string, DbViewData> = await res.json()
      console.log(`BVS: received root data keys:`, Object.keys(rootData), `shape=${shape}`)
      let count = 0
      for (const [viewId, dbViewData] of Object.entries(rootData)) {
        try {
          this._extractInlineSparklines(viewId, dbViewData)
          const rv = assembleReportView(dbViewData)
          const cacheKey = this._cacheKey(viewId)
          this.viewCache.set(cacheKey, rv)
          this._viewShapes.set(cacheKey, shape)
          count++
        } catch (transformErr) {
          console.log(`BVS: failed to transform root view ${viewId}:`, transformErr)
        }
      }
      console.log(`BVS preloaded ${count} root views`)
      return count
    } catch (err) {
      console.log("BVS preload roots error:", err)
      return 0
    }
  }

  getProcessedData(viewId: string, params: DataShapingParams): ProcessedViewData {
    const cacheKey = this._cacheKey(viewId)
    const view = this.viewCache.get(cacheKey)
    if (!view) {
      return {
        displayData: [],
        kpi: { budget: 0, consumed: 0, variance: 0, percent: 0, excludedSpend: 0, reconciliation: { rowCount: 0, includedRows: 0, excludedRows: 0, checksum: "bvs-0-0" } },
        entityTypeLabel: "Loading…",
        breadcrumbPath: [],
        scopeLabel: "Loading…",
        isTransactionView: false,
        isVendorView: false,
        showPeriod: false,
      }
    }

    // Ship 4b: detect v2 enriched payload from per-view shape map.
    const isEnriched = this._viewShapes.get(cacheKey) === "v2"

    let rows = view.rows
    if (params.pivotBy === "facility" && viewId === params.rootViewId && params.facilityScope !== "all") {
      rows = rows.filter(r => r.label === params.facilityScope)
    }

    // Transaction drill: scope rows to the selected timeframe using their txn_date.
    // Server returns the full year's txns; client filters to the user's selection.
    const isTxnView = view.entityTypeLabel === "Transactions"
    if (isTxnView && this.anchorDate) {
      const { start, end } = getTimeframeRange(params.timeframe, this.anchorDate)
      const startStr = start.toISOString().slice(0, 10)
      const endStr = end.toISOString().slice(0, 10)
      rows = rows.filter(r => {
        const d = r.lastTxnDate
        return d != null && d >= startStr && d <= endStr
      })
    }

    const baseRows = rows.map((r, i) => mapRowWithEntity(r, view.entityTypeLabel, i))

    // Transaction-level PPD is not meaningful (doctrine: PPD is aggregate, not per-txn).
    // Option A — render txn detail in dollars regardless of the metric selector.
    const effectiveParams: DataShapingParams = isTxnView ? { ...params, metric: "dollars" } : params

    // Look up cached period data for this view+viewBy
    const periodCacheKey = `${cacheKey}:${params.viewBy}`
    const periodData = this.periodDataCache.get(periodCacheKey)
    const displayData = applyDataShaping(baseRows, effectiveParams, periodData, this.anchorDate, isEnriched)

    const tm = isEnriched ? 1 : TIMEFRAME_MULTIPLIER[params.timeframe]

    // Spend mode is applied server-side — KPI consumed is already correct
    let kpiBaseConsumed = view.kpi.consumed

    let kpiBudget: number
    let kpiConsumed: number
    let kpiVariance: number
    let kpiPercent: number

    // Compute timeframe-scoped person-days for PPD KPI (legacy path only).
    // In v2 enriched mode, KPI uses server-computed totalPersonDays directly.
    const scopedTotalPersonDays = isEnriched
      ? (view.kpi.totalPersonDays ?? 0)
      : resolvePersonDays(
          view.kpi.monthlyPersonDays,
          view.kpi.totalPersonDays,
          params.timeframe,
          this.anchorDate,
        )

    // Txn-level KPI is always in dollars regardless of metric selector (Option A).
    if (isTxnView) {
      kpiBudget = view.kpi.budget * tm
      kpiConsumed = kpiBaseConsumed * tm
      kpiVariance = kpiBudget - kpiConsumed
      kpiPercent = kpiBudget !== 0 ? (kpiVariance / kpiBudget) * 100 : 0
    } else if (params.metric === "ppd") {
      // Ship 4b v2: read server-computed PPD straight off KPI payload.
      if (isEnriched) {
        // null PPD means "no census" — display as 0 (UI may layer "--" via _ppdNull).
        kpiBudget = view.kpi.budgetPPD ?? 0
        kpiConsumed = view.kpi.spendPPD ?? 0
        kpiVariance = view.kpi.variancePPD ?? 0
        kpiPercent = kpiBudget !== 0 ? (kpiVariance / kpiBudget) * 100 : 0
      } else if (scopedTotalPersonDays > 0) {
        // Legacy: PPD KPI = portfolio spend / timeframe-scoped portfolio person-days
        kpiBudget = (view.kpi.budget * tm) / scopedTotalPersonDays
        kpiConsumed = (kpiBaseConsumed * tm) / scopedTotalPersonDays
        kpiVariance = kpiBudget - kpiConsumed
        kpiPercent = kpiBudget !== 0 ? (kpiVariance / kpiBudget) * 100 : 0
      } else {
        kpiBudget = 0
        kpiConsumed = 0
        kpiVariance = 0
        kpiPercent = 0
      }
    } else {
      // Dollars KPI — in v2 the server already scoped to timeframe (tm===1).
      kpiBudget = view.kpi.budget * tm
      kpiConsumed = kpiBaseConsumed * tm
      kpiVariance = kpiBudget - kpiConsumed
      kpiPercent = kpiBudget !== 0 ? (kpiVariance / kpiBudget) * 100 : 0
    }

    return {
      displayData,
      kpi: { ...view.kpi, budget: kpiBudget, consumed: kpiConsumed, variance: kpiVariance, percent: kpiPercent, totalPersonDays: scopedTotalPersonDays },
      entityTypeLabel: view.entityTypeLabel,
      breadcrumbPath: view.breadcrumbPath,
      scopeLabel: view.scopeLabel,
      isTransactionView: view.entityTypeLabel === "Transactions",
      isVendorView: view.entityTypeLabel === "Vendors",
      showPeriod: params.viewBy !== "fullTimeframe",
    }
  }

  getFacilityNames(): string[] {
    return this.facilityNamesCache ?? []
  }

  async fetchFacilityNames(): Promise<string[]> {
    if (this.facilityNamesCache) return this.facilityNamesCache
    try {
      const res = await fetch(`${BVS_BASE}/facility-names`, { headers: hdrs() })
      if (res.ok) {
        this.facilityNamesCache = await res.json()
        return this.facilityNamesCache!
      }
    } catch (err) {
      console.log("BVS facility names error:", err)
    }
    return []
  }

  async fetchAnchorDate(): Promise<Date | null> {
    if (this.anchorDate) return this.anchorDate
    try {
      const res = await fetch(`${BVS_BASE}/anchor-date`, { headers: hdrs() })
      if (res.ok) {
        const data = await res.json()
        const dateStr = data?.anchorDate
        if (dateStr && typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [y, m, d] = dateStr.split("-").map(Number)
          const parsed = new Date(y, m - 1, d)
          if (!isNaN(parsed.getTime())) {
            this.anchorDate = parsed
            console.log(`BVS anchor date: ${dateStr}`)
            return this.anchorDate
          }
        }
        console.log(`BVS anchor date: invalid format from server:`, data)
      }
    } catch (err) {
      console.log("BVS anchor date error:", err)
    }
    return null
  }

  /** Fetch per-period (monthly/quarterly) breakdown data from server */
  async fetchPeriodData(viewId: string, viewBy: string): Promise<PeriodMap | null> {
    if (viewBy !== "monthly" && viewBy !== "quarterly") return null

    const baseKey = this._cacheKey(viewId)
    const cacheKey = `${baseKey}:${viewBy}`
    const cached = this.periodDataCache.get(cacheKey)
    if (cached) return cached

    const pending = this.pendingPeriodFetches.get(cacheKey)
    if (pending) return pending

    const promise = (async () => {
      try {
        // Ship 4b: append start/end when set so period data matches the timeframe.
        const rangeParams = (this._startDate && this._endDate)
          ? `&start=${this._startDate}&end=${this._endDate}`
          : ""
        console.log(`BVS: fetching period data for ${viewId} (${viewBy}, range=${this._startDate ?? "anchor"}..${this._endDate ?? "anchor"})`)
        // Phase 4: engine /drill/periods supports all 12 valid drill paths
        // including the 4 new Option B canonical orderings (G→F, G→F→V, V→G,
        // V→G→F) for which legacy /periods has no equivalent.
        const url = USE_ENGINE
          ? buildEnginePeriodsUrl(viewId, viewBy, this._spendMode, this._startDate, this._endDate)
          : `${BVS_BASE}/view/${viewId}/periods?viewBy=${viewBy}&spendMode=${this._spendMode}${rangeParams}`
        const res = await fetch(url, { headers: hdrs() })
        if (!res.ok) {
          const txt = await res.text()
          console.log(`BVS period fetch failed (${res.status}): ${txt}`)
          return null
        }
        const data = await res.json()
        const periodMap: PeriodMap = data?.periods ?? {}
        this.periodDataCache.set(cacheKey, periodMap)
        console.log(`BVS: period data cached for ${cacheKey} (${Object.keys(periodMap).length} entities)`)
        return periodMap
      } catch (err: any) {
        console.log(`BVS period fetch error:`, err?.message ?? err)
        return null
      } finally {
        this.pendingPeriodFetches.delete(cacheKey)
      }
    })()

    this.pendingPeriodFetches.set(cacheKey, promise)
    return promise
  }

  /** Extract inline trendSpend/trendBudgetAvg from raw view rows into sparkline cache.
   *  Called during fetchView/preloadRoots before assembleReportView. */
  _extractInlineSparklines(viewId: string, dbViewData: any): void {
    const rows = dbViewData?.rows
    if (!rows || !Array.isArray(rows) || rows.length === 0) return
    // Check if rows carry inline trend data
    const firstWithTrend = rows.find((r: any) => r.trendSpend && Array.isArray(r.trendSpend) && r.trendSpend.length > 0)
    if (!firstWithTrend) return

    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    // Infer year from the view context or default to 2025
    const year = dbViewData?.context?.timeframeStart
      ? Number(dbViewData.context.timeframeStart.slice(0, 4))
      : 2025
    const monthKeys = MONTHS.map(m => `${m} ${year}`)

    const sparklineMap: SparklineMap = {}
    for (const row of rows) {
      if (!row.entityId) continue
      const trendSpend: number[] = row.trendSpend ?? []
      const trendBudgetAvg: number = row.trendBudgetAvg ?? 0
      sparklineMap[row.entityId] = monthKeys.map((month, i) => ({
        month,
        spend: i < trendSpend.length ? (trendSpend[i] || null) : null,
        budget: trendBudgetAvg,
      }))
    }
    // Ship 4b: sparkline cache key uses the same cacheKey scheme as views
    const cacheKey = `${this._cacheKey(viewId)}:sparkline`
    this.sparklineCache.set(cacheKey, sparklineMap)
    console.log(`BVS: inline sparkline data extracted for ${viewId} (${Object.keys(sparklineMap).length} entities)`)
  }

  /** Fetch sparkline data from server — now a no-op since sparklines are inlined in the view response */
  async fetchSparklineData(viewId: string): Promise<SparklineMap | null> {
    const cacheKey = `${this._cacheKey(viewId)}:sparkline`
    const cached = this.sparklineCache.get(cacheKey)
    if (cached) return cached
    // Sparklines are now delivered inline with the view response.
    // If not yet available, the view hasn't been fetched yet — return null.
    console.log(`BVS: sparkline data for ${viewId} not yet available (will arrive with view fetch)`)
    return null
  }

  /** Get cached sparkline data (synchronous) */
  getSparklineData(viewId: string): SparklineMap | null {
    return this.sparklineCache.get(`${this._cacheKey(viewId)}:sparkline`) ?? null
  }
}

// ---------------------------------------------------------------------------
// Init helpers
// ---------------------------------------------------------------------------

export async function initBvsAdapter(): Promise<BvsAdapter | null> {
  const adapter = new BvsAdapter()

  // Strategy: Load just the default root (facility) via single-view endpoint.
  // This is much faster than the bulk /roots endpoint which builds all 3 pivots.
  // Other roots are fetched on-demand when the user switches pivots.
  //
  // Ship 4b note: this initial fetch goes through the legacy path (no
  // start/end). A useEffect in App.tsx will subsequently call
  // setTimeframeRange() with the resolved range, invalidating this initial
  // fetch and triggering a v2-path refetch. This costs one extra fetch on
  // first load — accepted in exchange for keeping init independent of the
  // app's timeframe state.
  try {
    console.log("BVS: fetching initial root (bvs-fac-root)...")
    const [facLoaded] = await Promise.all([
      adapter.preloadRoot("bvs-fac-root"),
      adapter.fetchFacilityNames(),
      adapter.fetchAnchorDate(),
    ])
    if (facLoaded) {
      console.log("BVS adapter initialized with facility root")
      return adapter
    }
  } catch (err) {
    console.log("BVS single-root init failed:", err)
    adapter.lastError = adapter.lastError ?? `Init exception: ${err}`
  }

  // Propagate the detailed error so the caller can display it
  const detail = adapter.lastError ?? "no root views loaded (unknown reason)"
  console.log(`BVS adapter init failed — ${detail}`)
  throw new Error(detail)
}