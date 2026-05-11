import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useEnterpriseGrid, GridState } from "./components/use-enterprise-grid"
import { EnterpriseGrid } from "./components/enterprise-grid"
import { budgetColumns } from "./components/budget-columns"
import { PIVOT_ROOT_VIEW } from "./components/data-source"
import type { PivotBy, FacilityScope } from "./components/data-source"
import { repository, setActiveAdapter } from "./components/repository"
import type { Timeframe, ViewBy, SpendMode, Metric } from "./components/repository"
import { projectId, publicAnonKey } from "/utils/supabase/info"
import { BvsAdapter, initBvsAdapter, BVS_ROOT_VIEW } from "./components/bvs-adapter"
import { getTimeframeRange } from "./components/timeframe-utils"

// Ship 4b: format a Date as ISO YYYY-MM-DD using local time so that
// "April 15" stays April 15 regardless of UTC offset. (toISOString uses UTC,
// which can shift the date by a day for late-evening US/Maine timestamps.)
function fmtIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Enterprise Budget Grid Application
export default function App() {
  const [gridState, setGridState] = useState<GridState>({
    sorting: [],
    columnVisibility: {},
    columnPinning: { left: ["name"] },
    columnSizing: {},
    columnSizingInfo: {},
    columnFilters: [],
  })

  const [viewState, setViewState] = useState<"default" | "loading" | "empty" | "error" | "connecting">("connecting")
  const [metric, setMetric] = useState<Metric>("dollars")
  const [spendMode, setSpendMode] = useState<SpendMode>("totalImpact")
  const [timeframe, setTimeframe] = useState<Timeframe>("monthToDate")
  const [viewBy, setViewBy] = useState<ViewBy>("fullTimeframe")
  const [facilityScope, setFacilityScope] = useState<FacilityScope>("all")
  const [pivotBy, setPivotBy] = useState<PivotBy>("facility")
  const [activeViewId, setActiveViewId] = useState<string>(PIVOT_ROOT_VIEW.facility)
  const [dataSource, setDataSource] = useState<"local" | "supabase" | "connecting">("connecting")
  const [bvsStatus, setBvsStatus] = useState<any>(null)
  const [bvsLoading, setBvsLoading] = useState(false)
  const [showBvsPanel, setShowBvsPanel] = useState(false)
  const [bvsAdapter, setBvsAdapter] = useState<BvsAdapter | null>(null)
  const [bvsDiag, setBvsDiag] = useState<any>(null)
  const [bvsDiagLoading, setBvsDiagLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [failedViewId, setFailedViewId] = useState<string | null>(null)
  const [lastGoodBreadcrumbs, setLastGoodBreadcrumbs] = useState<any[]>([])
  const [lastGoodScopeLabel, setLastGoodScopeLabel] = useState<string>("")
  const [periodDataVersion, setPeriodDataVersion] = useState(0)
  const [viewVersion, setViewVersion] = useState(0)

  const initRef = useRef<(() => void) | null>(null)

  // Initialize data adapters on mount: try BVS live first, then KV, then local
  useEffect(() => {
    let cancelled = false

    async function init() {
      // Try BVS live adapter first (direct Postgres queries) — this is the ONLY valid data source
      try {
        console.log("Attempting BVS live adapter init...")
        setViewState("connecting")
        setServerError(null)
        setDataSource("connecting")
        const adapter = await initBvsAdapter()
        if (adapter && !cancelled) {
          setActiveAdapter(adapter)
          setBvsAdapter(adapter)
          setDataSource("supabase")
          setActiveViewId(BVS_ROOT_VIEW.facility)
          setViewState("default")
          setViewVersion(v => v + 1)
          console.log("Switched to BvsAdapter (live Postgres)")
          return
        }
        if (!cancelled) {
          const errMsg = "Unable to load data from Supabase. BVS live adapter returned null — no valid data source available."
          console.error(`[DATA LOAD ERROR] ${errMsg} | endpoint: ${projectId}.supabase.co | timestamp: ${new Date().toISOString()}`)
          setServerError(errMsg)
          setDataSource("connecting")
          setViewState("error")
        }
      } catch (err) {
        if (!cancelled) {
          const errMsg = `Unable to load data from Supabase. BVS adapter init error: ${err}`
          console.error(`[DATA LOAD ERROR] ${errMsg} | endpoint: ${projectId}.supabase.co | timestamp: ${new Date().toISOString()}`)
          setServerError(errMsg)
          setDataSource("connecting")
          setViewState("error")
        }
      }
    }

    initRef.current = init
    init()

    // Also verify BVS connection
    async function verifyBvs() {
      try {
        setBvsLoading(true)
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-b98afb97/bvs/verify`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        )
        if (res.ok) {
          const data = await res.json()
          setBvsStatus(data)
          console.log("BVS verification result:", data)
        } else {
          const text = await res.text()
          setBvsStatus({ status: "ERROR", error: text })
          console.log("BVS verification failed:", text)
        }
      } catch (err) {
        setBvsStatus({ status: "ERROR", error: String(err) })
        console.log("BVS verification error:", err)
      } finally {
        setBvsLoading(false)
      }
    }
    verifyBvs()

    return () => { cancelled = true }
  }, [])

  // Handle drill-down: for BVS adapter, fetch view on-demand before switching
  const handleActiveViewIdChange = useCallback(async (newViewId: string) => {
    setFailedViewId(null)
    setServerError(null)
    if (bvsAdapter) {
      // Check if view is already cached
      const cached = bvsAdapter.getView(newViewId)
      if (!cached) {
        setViewState("loading")
        try {
          const fetched = await bvsAdapter.fetchView(newViewId)
          if (!fetched) {
            const errMsg = bvsAdapter.lastError ?? `View ${newViewId} could not be fetched`
            console.error(`[DATA LOAD ERROR] BVS view fetch failed | viewId: ${newViewId} | error: ${errMsg} | timestamp: ${new Date().toISOString()}`)
            setServerError(errMsg)
            setFailedViewId(newViewId)
            setViewState("error")
            return
          }
        } catch (err) {
          const errMsg = `Network error fetching view: ${err}`
          console.error(`[DATA LOAD ERROR] BVS view fetch threw | viewId: ${newViewId} | error: ${errMsg} | timestamp: ${new Date().toISOString()}`)
          setServerError(errMsg)
          setFailedViewId(newViewId)
          setViewState("error")
          return
        }
      }
    }
    setViewState("default")
    setActiveViewId(newViewId)
    setViewVersion(v => v + 1)
  }, [bvsAdapter])

  // Determine the correct root view ID based on active adapter
  const rootViewId = bvsAdapter ? BVS_ROOT_VIEW[pivotBy] : PIVOT_ROOT_VIEW[pivotBy]

  // Skip expensive data processing while connecting, loading, or in error — pass empty data to table
  const isReady = viewState !== "connecting" && viewState !== "loading" && viewState !== "error"

  // Get processed data through the repository (skip during connecting/loading)
  const processedData = useMemo(() => {
    if (!isReady) {
      return {
        displayData: [] as any[],
        kpi: { budget: 0, consumed: 0, variance: 0, percent: 0, excludedSpend: 0, reconciliation: { rowCount: 0, includedRows: 0, excludedRows: 0, checksum: "" } },
        entityTypeLabel: "Facilities",
        breadcrumbPath: [],
        scopeLabel: "",
        isTransactionView: false,
        isVendorView: false,
        showPeriod: false,
      }
    }
    return repository.getProcessedData(activeViewId, {
      spendMode,
      timeframe,
      metric,
      viewBy,
      facilityScope,
      pivotBy,
      rootViewId,
    })
  }, [isReady, activeViewId, spendMode, timeframe, metric, viewBy, facilityScope, pivotBy, dataSource, rootViewId, periodDataVersion, viewVersion])

  const { displayData, kpi, entityTypeLabel: nameHeader, breadcrumbPath, scopeLabel, isTransactionView, isVendorView, showPeriod } = processedData

  // Fetch period breakdown data when viewBy changes to monthly/quarterly
  useEffect(() => {
    if (!bvsAdapter || !isReady) return
    if (viewBy !== "monthly" && viewBy !== "quarterly") return
    let cancelled = false
    bvsAdapter.fetchPeriodData(activeViewId, viewBy).then(() => {
      if (!cancelled) {
        setPeriodDataVersion(v => v + 1) // trigger re-render with new period data
      }
    })
    return () => { cancelled = true }
  }, [bvsAdapter, activeViewId, viewBy, isReady])

  // Sync spend mode to BVS adapter — invalidate caches and re-fetch current view
  useEffect(() => {
    if (!bvsAdapter) return
    const changed = bvsAdapter.setSpendMode(spendMode)
    if (!changed) return
    // Re-fetch the current view with the new spend mode
    let cancelled = false
    setViewState("loading")
    bvsAdapter.fetchView(activeViewId).then((view) => {
      if (cancelled) return
      if (view) {
        setViewState("default")
        setViewVersion(v => v + 1)
      } else {
        setServerError(bvsAdapter.lastError ?? `Failed to refetch view for spend mode ${spendMode}`)
        setViewState("error")
      }
    })
    return () => { cancelled = true }
  }, [bvsAdapter, spendMode, activeViewId])

  // Ship 4b: Sync timeframe range to BVS adapter — invalidate caches and
  // re-fetch the current view with the v2 enriched payload. Mirrors the
  // spend-mode sync pattern above.
  //
  // The timeframe enum is converted to (start, end) ISO dates using
  // getTimeframeRange anchored on bvsAdapter.anchorDate. When the user changes
  // the timeframe selector, this effect runs, the adapter invalidates its
  // cache, and a refetch hits the server with new start/end query params.
  useEffect(() => {
    if (!bvsAdapter || !bvsAdapter.anchorDate) return
    const { start, end } = getTimeframeRange(timeframe, bvsAdapter.anchorDate)
    const startStr = fmtIsoDate(start)
    const endStr = fmtIsoDate(end)
    const changed = bvsAdapter.setTimeframeRange(startStr, endStr)
    if (!changed) return
    let cancelled = false
    setViewState("loading")
    bvsAdapter.fetchView(activeViewId).then((view) => {
      if (cancelled) return
      if (view) {
        setViewState("default")
        setViewVersion(v => v + 1)
      } else {
        setServerError(bvsAdapter.lastError ?? `Failed to refetch view for timeframe ${timeframe}`)
        setViewState("error")
      }
    })
    return () => { cancelled = true }
  }, [bvsAdapter, timeframe, activeViewId])

  // Sparkline data is now delivered inline with the view response — no separate fetch needed.
  // Read from cache (populated during fetchView).
  const sparklineData = useMemo(() => {
    if (!bvsAdapter) return null
    return bvsAdapter.getSparklineData(activeViewId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bvsAdapter, activeViewId, viewVersion])

  // Preserve breadcrumbs across loading/error states so user can always navigate back
  useEffect(() => {
    if (breadcrumbPath.length > 0) {
      setLastGoodBreadcrumbs(breadcrumbPath)
      setLastGoodScopeLabel(scopeLabel)
    }
  }, [breadcrumbPath, scopeLabel])

  // Use last-known breadcrumbs during loading/error for navigation
  const activeBreadcrumbs = breadcrumbPath.length > 0 ? breadcrumbPath : lastGoodBreadcrumbs
  const activeScopeLabel = scopeLabel || lastGoodScopeLabel

  // No auto-recovery — show error state clearly so user knows drill-down failed
  const effectiveViewState = viewState

  // Update column pinning reactively (useEffect avoids setState-during-render)
  const pinnedCol = isTransactionView ? "transactions" : "name"
  useEffect(() => {
    if ((gridState.columnPinning.left?.[0] ?? "name") !== pinnedCol) {
      setGridState(prev => ({ ...prev, columnPinning: { left: [pinnedCol] } }))
    }
  }, [pinnedCol])

  const [overlayTransaction, setOverlayTransaction] = useState<string | null>(null)

  const handleTransactionClick = useCallback((label: string) => {
    setOverlayTransaction(label)
  }, [])

  // Transaction-level PPD is not a valid concept (doctrine: PPD is aggregate).
  // Option A: always render transactions in dollars regardless of the metric selector.
  const columnMetric = isTransactionView ? "dollars" : metric
  const columns = useMemo(() => budgetColumns(columnMetric, nameHeader, showPeriod, isTransactionView, handleTransactionClick, isVendorView, sparklineData), [columnMetric, nameHeader, showPeriod, isTransactionView, handleTransactionClick, isVendorView, sparklineData])

  // Pass empty data to table during non-ready states to avoid wasted computation
  const tableData = effectiveViewState === "connecting" || effectiveViewState === "loading" || effectiveViewState === "error" ? [] : displayData

  const table = useEnterpriseGrid(
    tableData,
    columns,
    gridState,
    setGridState
  )

  return (
    <div className="size-full">
      {/* Data source indicator */}
      <div className="fixed bottom-2 right-2 z-[100] flex flex-col items-end gap-1">
        <div
          className="px-2 py-1 rounded text-xs font-mono opacity-70 cursor-pointer"
          style={{
            backgroundColor: dataSource === "supabase" ? "#065f46" : viewState === "error" ? "#991b1b" : "#92400e",
            color: "#fff",
          }}
          onClick={() => setShowBvsPanel(p => !p)}
          title="Click to toggle BVS connection details"
        >
          {dataSource === "supabase"
            ? "DB: Connected"
            : viewState === "error"
              ? "DB: Error"
              : "DB: Loading..."}
        </div>
      </div>

      {/* BVS verification detail panel */}
      {showBvsPanel && bvsStatus && (
        <div className="fixed bottom-14 right-2 z-[101] w-[420px] max-h-[80vh] overflow-auto bg-white border border-gray-300 rounded-lg shadow-xl text-xs font-mono">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
            <span className="font-semibold text-sm" style={{ fontFamily: "'Nunito Sans', sans-serif" }}>BVS Connection Verification</span>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700 cursor-pointer"
              style={{ background: "none", border: "none", fontSize: 16, lineHeight: 1 }}
              onClick={() => setShowBvsPanel(false)}
            >✕</button>
          </div>
          <div className="p-3 space-y-3">
            {/* Overall status */}
            <div className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${bvsStatus.connectionLive ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-semibold">{bvsStatus.status}</span>
              {bvsStatus.connectionLive && <span className="text-green-700">Connection live, join grain correct</span>}
            </div>

            {/* Table counts */}
            {bvsStatus.tableCounts && (
              <div>
                <div className="font-semibold mb-1 text-gray-600">Table Counts</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-0.5 pr-2">Table</th>
                      <th className="py-0.5 pr-2 text-right">Rows</th>
                      <th className="py-0.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(bvsStatus.tableCounts).map(([table, info]: [string, any]) => (
                      <tr key={table} className="border-b border-gray-100">
                        <td className="py-0.5 pr-2 text-gray-800">{table}</td>
                        <td className="py-0.5 pr-2 text-right">{info.count?.toLocaleString() ?? "—"}</td>
                        <td className="py-0.5">{info.error ? <span className="text-red-600">{info.error}</span> : <span className="text-green-600">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Verification query result */}
            {bvsStatus.verificationQuery && (
              <div>
                <div className="font-semibold mb-1 text-gray-600">Verification Join Query (2025)</div>
                {bvsStatus.verificationQuery.error ? (
                  <div className="text-red-600 break-all">{bvsStatus.verificationQuery.error}</div>
                ) : bvsStatus.verificationQuery.result ? (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">total_spend:</span>
                      <span className="text-gray-900 font-semibold">
                        ${Number(bvsStatus.verificationQuery.result.total_spend).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">total_budget:</span>
                      <span className="text-gray-900 font-semibold">
                        ${Number(bvsStatus.verificationQuery.result.total_budget).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${bvsStatus.verificationQuery.pass ? "bg-green-500" : "bg-red-500"}`} />
                      <span className={bvsStatus.verificationQuery.pass ? "text-green-700" : "text-red-700"}>
                        {bvsStatus.verificationQuery.pass ? "Both non-null — PASS" : "FAIL"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No result</div>
                )}
              </div>
            )}

            {bvsStatus.error && (
              <div className="text-red-600 break-all">{bvsStatus.error}</div>
            )}

            {/* Diagnostic runner */}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <button
                type="button"
                className="px-3 py-1 rounded text-white text-xs cursor-pointer"
                style={{ backgroundColor: "#005390", border: "none", font: "inherit" }}
                disabled={bvsDiagLoading}
                onClick={async () => {
                  setBvsDiagLoading(true)
                  try {
                    const res = await fetch(
                      `https://${projectId}.supabase.co/functions/v1/make-server-b98afb97/bvs/report/diag`,
                      { headers: { Authorization: `Bearer ${publicAnonKey}` } }
                    )
                    const data = await res.json()
                    setBvsDiag(data)
                    console.log("BVS diag result:", data)
                  } catch (err) {
                    setBvsDiag({ status: "FETCH_ERROR", error: String(err) })
                  } finally {
                    setBvsDiagLoading(false)
                  }
                }}
              >
                {bvsDiagLoading ? "Running..." : "Run BVS Query Diagnostic"}
              </button>
              {bvsDiag && (
                <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto text-[10px] leading-tight max-h-48">
                  {JSON.stringify(bvsDiag, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {isTransactionView && metric === "ppd" && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-md border text-sm"
          style={{ background: "#FFFBEB", borderColor: "#FCD34D", color: "#92400E" }}>
          Showing transaction detail in dollars. PPD applies at vendor level and above.
        </div>
      )}

      <EnterpriseGrid
        table={table}
        gridState={gridState}
        onGridStateChange={setGridState}
        viewState={effectiveViewState}
        activeData={displayData}
        kpi={kpi}
        metric={metric}
        onMetricChange={setMetric}
        spendMode={spendMode}
        onSpendModeChange={setSpendMode}
        timeframe={timeframe}
        onTimeframeChange={(tf: Timeframe) => {
          setTimeframe(tf)
          setViewBy("fullTimeframe" as ViewBy)
        }}
        viewBy={viewBy}
        onViewByChange={(vb: ViewBy) => {
          setViewBy(vb)
          if (vb === "fullTimeframe") {
            setGridState(prev => ({
              ...prev,
              columnFilters: prev.columnFilters.filter(f => f.id !== "period"),
            }))
          }
        }}
        facilityScope={facilityScope}
        onFacilityScopeChange={setFacilityScope}
        pivotBy={pivotBy}
        onPivotByChange={(p: PivotBy) => {
          setPivotBy(p)
          const rootId = bvsAdapter ? BVS_ROOT_VIEW[p] : PIVOT_ROOT_VIEW[p]
          handleActiveViewIdChange(rootId)
        }}
        activeViewId={activeViewId}
        onActiveViewIdChange={handleActiveViewIdChange}
        breadcrumbPath={activeBreadcrumbs}
        scopeLabel={activeScopeLabel}
        failedViewId={failedViewId}
        onRetry={() => {
          if (failedViewId) {
            handleActiveViewIdChange(failedViewId)
          } else if (initRef.current) {
            // Retry initial connection without full page reload
            initRef.current()
          }
        }}
        serverError={serverError}
        anchorDate={bvsAdapter?.anchorDate ?? null}
        isVendorView={isVendorView}
      />
      {overlayTransaction !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setOverlayTransaction(null)}
        >
          <div
            className="bg-white rounded-[6px] shadow-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 style={{ fontWeight: 600 }}>Prototype Boundary</h2>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                style={{ background: "none", border: "none", font: "inherit", fontSize: "18px", lineHeight: 1 }}
                onClick={() => setOverlayTransaction(null)}
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              {overlayTransaction?.startsWith("ACCRUAL:") ? (
                <>
                  <p className="mb-3" style={{ color: "#005390", fontWeight: 600 }}>{overlayTransaction.replace("ACCRUAL:", "")}</p>
                  <p className="text-gray-600 mb-2">Manual accrual details should appear here.</p>
                  <p className="text-gray-500 mb-3">This interaction is currently stubbed in the prototype. In a future iteration, this overlay should display the information needed to understand and manage the accrual entry.</p>
                  <p className="text-gray-500 text-sm">Expected information may include:</p>
                  <ul className="text-gray-500 text-sm mt-1 ml-4 list-disc space-y-0.5">
                    <li>Accrual identifier</li>
                    <li>Description / memo</li>
                    <li>Amount</li>
                    <li>Accrual date</li>
                    <li>Effective budget period</li>
                    <li>Facility</li>
                    <li>GL account</li>
                    <li>Vendor, if applicable</li>
                    <li>Source / reason for accrual</li>
                    <li>Created by</li>
                    <li>Created date</li>
                    <li>Last updated date</li>
                    <li>Current status</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="mb-3" style={{ color: "#005390", fontWeight: 600 }}>{overlayTransaction}</p>
                  <p className="text-gray-600 mb-2">Transaction details should appear here.</p>
                  <p className="text-gray-500">This interaction is currently stubbed in the prototype. In a future iteration, this overlay will display full transaction details, including PO and invoice information.</p>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                className="px-4 py-1.5 rounded-[6px] text-white cursor-pointer"
                style={{ backgroundColor: "#005390", border: "none", font: "inherit" }}
                onClick={() => setOverlayTransaction(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}