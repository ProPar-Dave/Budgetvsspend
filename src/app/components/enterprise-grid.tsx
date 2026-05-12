import { type CSSProperties, useRef, useEffect, useState } from "react"
import { type Column } from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEnterpriseGrid } from "./use-enterprise-grid"
import { GridState } from "./use-enterprise-grid"
import type { BreadcrumbSegment } from "./data-source"
import type { ReportKpi } from "./data-source"
import { DateRangePickerPopover, formatDateRange } from "./date-range-picker"
import { getTimeContextLabel as computeTimeLabel, FALLBACK_ANCHOR } from "./timeframe-utils"
import { formatCurrencyAbbrev } from "./budget-columns"
import React from "react"

type Density = "comfortable" | "standard" | "compact"

// Live elapsed timer for loading states
function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  useEffect(() => {
    startRef.current = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return (
    <span className="text-[12px] text-gray-400 font-mono tabular-nums">
      {mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`}
    </span>
  )
}

const MIN_ROW_HEIGHT = 40

const DENSITY_PADDING_CLASS: Record<Density, string> = {
  comfortable: "py-3",
  standard: "py-2",
  compact: "py-1",
}

const DENSITY_INPUT_HEIGHT: Record<Density, number> = {
  comfortable: 28,
  standard: 24,
  compact: 20,
}

// Audit event type and dispatcher
type AuditEvent = {
  type: string
  columnId?: string
  rowId?: string
  oldValue?: any
  newValue?: any
  metadata?: Record<string, any>
  level?: string
  target?: any
}

function emitAudit(event: AuditEvent) {
  console.log("[GRID AUDIT]", event)
}

type ViewState = "default" | "loading" | "empty" | "error" | "connecting"

type EnterpriseGridProps<T> = {
  table: ReturnType<typeof useEnterpriseGrid<T>>
  gridState: GridState
  onGridStateChange: (state: GridState) => void
  viewState: ViewState
  activeData: any[]
  kpi: ReportKpi
  metric: "dollars" | "ppd"
  onMetricChange: (metric: "dollars" | "ppd") => void
  spendMode: "actual" | "commitment" | "totalImpact"
  onSpendModeChange: (spendMode: "actual" | "commitment" | "totalImpact") => void
  timeframe: string
  onTimeframeChange: (timeframe: any) => void
  viewBy: string
  onViewByChange: (viewBy: any) => void
  facilityScope: string
  onFacilityScopeChange: (facilityScope: string) => void
  pivotBy: "facility" | "glAccount" | "vendor"
  onPivotByChange: (pivotBy: "facility" | "glAccount" | "vendor") => void
  activeViewId: string
  onActiveViewIdChange: (viewId: string) => void
  breadcrumbPath: BreadcrumbSegment[]
  scopeLabel: string
  failedViewId?: string | null
  onRetry?: () => void
  serverError?: string | null
  anchorDate?: Date | null
  isVendorView?: boolean
}

function getPinnedStyle(
  column: Column<any, any>,
  isHeader: boolean
): CSSProperties {
  const pinned = column.getIsPinned()

  if (isHeader) {
    const style: CSSProperties = {
      position: "sticky",
      top: 0,
      zIndex: pinned ? 30 : 20,
    }
    if (pinned === "left") style.left = column.getStart("left")
    if (pinned === "right") style.right = column.getAfter("right")
    return style
  }

  if (!pinned) return {}
  return {
    position: "sticky",
    left: pinned === "left" ? column.getStart("left") : undefined,
    right: pinned === "right" ? column.getAfter("right") : undefined,
    zIndex: 5,
  }
}

function getBoundaryShadow(
  column: Column<any, any>,
  table: ReturnType<typeof useEnterpriseGrid<any>>
): CSSProperties {
  const pinned = column.getIsPinned()
  if (!pinned) return {}

  if (pinned === "left") {
    const leftCols = table.getLeftLeafColumns()
    if (column.id === leftCols[leftCols.length - 1]?.id) {
      return { boxShadow: "4px 0 4px -2px rgba(0,0,0,0.1)" }
    }
  }

  if (pinned === "right") {
    const rightCols = table.getRightLeafColumns()
    if (column.id === rightCols[0]?.id) {
      return { boxShadow: "-4px 0 4px -2px rgba(0,0,0,0.1)" }
    }
  }

  return {}
}

/** Full-precision currency for KPI tooltips: "$39,711,380.65" */
function formatKpiCurrencyFull(value: number): string {
  const abs = Math.abs(value)
  const formatted = "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return value < 0 ? "-" + formatted : formatted
}

/** Abbreviated currency for KPI display — uses same rules as table columns */
function formatKpiCurrency(value: number): string {
  return formatCurrencyAbbrev(value)
}

function formatKpiPpd(value: number): string {
  const abs = Math.abs(value)
  const formatted = "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return value < 0 ? "-" + formatted : formatted
}

export function EnterpriseGrid<T>({ table, gridState, onGridStateChange, viewState, activeData, kpi, metric, onMetricChange, spendMode, onSpendModeChange, timeframe, onTimeframeChange, viewBy, onViewByChange, facilityScope, onFacilityScopeChange, pivotBy, onPivotByChange, activeViewId, onActiveViewIdChange, breadcrumbPath, scopeLabel, failedViewId, onRetry, serverError, anchorDate, isVendorView }: EnterpriseGridProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const stickyHeaderRef = useRef<HTMLDivElement>(null)
  const [density, setDensity] = useState<Density>("compact")
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0)
  const [selectedRowName, setSelectedRowName] = useState<string | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [customStart, setCustomStart] = useState<Date | null>(null)
  const [customEnd, setCustomEnd] = useState<Date | null>(null)
  const [prevTimeframe, setPrevTimeframe] = useState<string>(timeframe)
  const rows = table.getRowModel().rows

  // Round 4c — derive GL-in-scope signal for KPI annotation gating. Per
  // directive, the GL applicability annotation appears when:
  //   - GL is grouped (groupBy=gl, rows have basis=gl_applicability or not_applicable)
  //   - OR a GL filter exists (same row signal)
  //   - OR any visible row has gl_applicability basis
  // All three reduce to: at least one visible row has basis in
  // {gl_applicability, not_applicable}.
  const hasAnyGlScopedRow = rows.some(r => {
    const basis = (r.original as any)?._ppdCalculationBasis
    return basis === "gl_applicability" || basis === "not_applicable"
  })

  // Round 4c — dev-mode drift detector. Asserts engine ↔ UI invariant:
  //   _personDays + _nonApplicablePersonDays === sum(_personDaysByType.values)
  // Runs once per render. Logs `[bvs.applicability.drift]` for grep targets.
  // Lightweight: only iterates rows with basis set, skips legacy/pre-4b rows.
  if (typeof window !== "undefined") {
    for (const r of rows) {
      const o: any = r.original
      if (!o || !o._ppdCalculationBasis) continue
      const byType = o._personDaysByType as Record<string, number> | null | undefined
      if (!byType) continue
      const byTypeSum = Object.values(byType).reduce((a, b) => a + Number(b), 0)
      const claimed = Number(o._personDays ?? 0) + Number(o._nonApplicablePersonDays ?? 0)
      if (Math.abs(byTypeSum - claimed) > 0.001) {
        // eslint-disable-next-line no-console
        console.warn(
          `[bvs.applicability.drift] label=${o.label ?? "(no label)"} basis=${o._ppdCalculationBasis} personDays=${o._personDays} nonApplicable=${o._nonApplicablePersonDays} byTypeSum=${byTypeSum}`
        )
      }
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => MIN_ROW_HEIGHT,
    overscan: 15,
  })

  const cellPadding = DENSITY_PADDING_CLASS[density]
  const inputHeight = DENSITY_INPUT_HEIGHT[density]

  // Determine if any report control is non-default
  const hasNonDefaultLens = facilityScope !== "all" || timeframe !== "monthToDate" || metric !== "dollars" || spendMode !== "actual"

  // Cell classes — single-side borders (right + bottom) to match border-separate with borderSpacing:0
  const thBaseClass = `border-r border-t box-border ${hasNonDefaultLens ? "bg-[#f0f5fa]" : "bg-[#f4f5f7]"}`
  const thPinnedBaseClass = `border-r border-t box-border ${hasNonDefaultLens ? "bg-[#f0f5fa]" : "bg-[#f4f5f7]"}`
  const tdBaseClass = `border-r border-b border-gray-200 px-3 box-border`
  const inputClass = "w-full box-border border-x-0 border-t border-b-0 border-t-gray-200 rounded-none leading-none py-0 px-3 text-xs focus:outline-none focus:ring-0 focus:shadow-none shadow-none focus:border-x focus:border-b focus:border-[#005390] focus:border-t-[#005390] focus:bg-white"

  // Shared header cell renderer
  function renderHeaderCell(header: any) {
    const canSort = header.column.getCanSort()
    const sortDir = header.column.getIsSorted()
    const canFilter = header.column.getCanFilter()
    const colMeta = header.column.columnDef.meta as { numeric?: boolean } | undefined
    const isNumeric = !!(header.column.columnDef.meta as any)?.numeric
    const alignClass = isNumeric ? "text-right" : "text-left"
    const headerSub = (header.column.columnDef.meta as any)?.headerSub
    const isGroupStart = !!(header.column.columnDef.meta as any)?.groupStart
    const isGroupEnd = !!(header.column.columnDef.meta as any)?.groupEnd
    const groupBorderClass = `${isGroupStart ? "border-l border-l-[#D8EAF6]" : ""} ${isGroupEnd ? "border-r border-r-[#D8EAF6]" : ""}`
    const isFirstCol = header.column.getIndex() === 0
    const isPinned = !!header.column.getIsPinned()

    return (
      <th
        key={header.id}
        className={`${isPinned ? thPinnedBaseClass : thBaseClass} pt-0.5 pb-0 text-left ${groupBorderClass} align-top relative border-t-[#D8EAF6] border-r-[#D8EAF6]`}
        style={{
          width: header.getSize(),
          ...getPinnedStyle(header.column, true),
          top: stickyHeaderHeight,
          ...getBoundaryShadow(header.column, table as any),
          borderTopColor: "#D8EAF6",
          borderRightColor: "#D8EAF6",
          borderLeftColor: "#D8EAF6",
          borderBottom: "1px solid #9FA6BC",
          color: "#1e293b",
        }}
      >
        <div className="flex flex-col gap-px h-full w-full min-w-0">
          <div className={`flex items-center min-w-0 px-3`}>
            {!isNumeric && (
              <span
                className={`flex-1 select-none truncate ${canSort ? "cursor-pointer" : ""} text-[14px]`}
                style={{ fontWeight: 600, color: "#005390" }}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                {header.isPlaceholder ? null : (header.column.columnDef.header as any)}
                {sortDir === "asc" ? " ↑" : sortDir === "desc" ? " ↓" : canSort ? <span className="text-gray-300 ml-1">⇅</span> : ""}
              </span>
            )}
            {isNumeric && (
              <span
                className={`flex-1 select-none truncate text-left ${canSort ? "cursor-pointer" : ""} text-[14px]`}
                style={{ fontWeight: 600, color: "#005390" }}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                {header.isPlaceholder ? null : (header.column.columnDef.header as any)}
                {sortDir === "asc" ? " ↑" : sortDir === "desc" ? " ↓" : canSort ? <span className="text-gray-300 ml-1">⇅</span> : ""}
              </span>
            )}
          </div>
          {headerSub && (
            <div className={`text-[10px] text-gray-400 truncate text-left px-3`}>
              {headerSub}
            </div>
          )}
          {canFilter && (
            <div className="mt-auto w-full relative">
              <input
                type="text"
                value={(header.column.getFilterValue() as string) ?? ""}
                onChange={(e) => {
                  const newValue = e.target.value || undefined
                  header.column.setFilterValue(newValue)
                  emitAudit({
                    type: "FILTER_CHANGE",
                    columnId: header.column.id,
                    newValue,
                  })
                }}
                onClick={(e) => e.stopPropagation()}
                className={`${inputClass} block pr-6 border-t-[#D8EAF6]`}
                style={{ height: inputHeight }}
                placeholder="Filter..."
              />
              {header.column.getFilterValue() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    header.column.setFilterValue(undefined)
                    emitAudit({ type: "FILTER_CHANGE", columnId: header.column.id, newValue: undefined })
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full text-white cursor-pointer"
                  style={{ fontSize: 10, lineHeight: 1, backgroundColor: '#005390' }}
                  aria-label="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
        {header.column.getCanResize() && (
          <div
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            className={`absolute cursor-col-resize select-none`}
            style={{ zIndex: 1, width: 4, height: 12, right: 0, top: 0, borderRadius: 0, backgroundColor: header.column.getIsResizing() ? '#005390' : '#AEB3BC' }}
          />
        )}
      </th>
    )
  }

  // Shared body cell renderer
  function renderBodyCell(cell: any) {
    const colMeta = cell.column.columnDef.meta as
      | { editable?: boolean; numeric?: boolean; groupStart?: boolean; groupEnd?: boolean }
      | undefined
    const isColumnEditable = colMeta?.editable === true
    const isNumeric = colMeta?.numeric === true
    const alignClass = isNumeric ? "text-right" : "text-left"
    const isGroupStart = !!colMeta?.groupStart
    const isGroupEnd = !!colMeta?.groupEnd
    const groupBorderClass = `${isGroupStart ? "border-l border-l-gray-200" : ""} ${isGroupEnd ? "border-r border-r-gray-200" : ""}`
    const isFirstCol = cell.column.getIndex() === 0
    const firstColBorder = ""
    const isNameCol = cell.column.id === "name"
    const isStatusCol = cell.column.id === "status"

    // Row-level status for text emphasis
    const rowOriginal = cell.row.original as any
    const rowStatus = rowOriginal._status as string | undefined
    const isExcluded = rowStatus === "excluded"
    const isOverBudget = rowStatus === "over_budget"
    const isOnTrack = rowStatus === "on_track"
    const rowBg = isOverBudget
      ? "bg-red-50/50"
      : isOnTrack
      ? "bg-amber-50/30"
      : ""

    const isPinned = cell.column.getIsPinned()
    const pinnedBg = isPinned ? "bg-white group-hover:bg-blue-50/60" : ""
    
    // For pinned body cells in virtualized rows, use translateX to simulate sticky
    const bodyPinnedStyle: CSSProperties = (() => {
      if (isPinned === "left") {
        return {
          position: "sticky" as const,
          left: 0,
          zIndex: 5,
          ...getBoundaryShadow(cell.column, table as any),
        }
      }
      return {}
    })()

    const basePinnedStyle: CSSProperties = {
      minHeight: MIN_ROW_HEIGHT,
      width: cell.column.getSize(),
      minWidth: cell.column.getSize(),
      maxWidth: cell.column.getSize(),
      ...bodyPinnedStyle,
    }

    // All body cells render as read-only data
    return (
      <td key={cell.id} className={`${tdBaseClass} ${firstColBorder} ${cellPadding} ${pinnedBg} ${alignClass} ${groupBorderClass} overflow-hidden align-top`} style={basePinnedStyle}>
        <div className={`flex items-start w-full min-w-0 overflow-hidden ${isNumeric ? "justify-end" : ""}`}>
          <span
            className={`${isNumeric ? "whitespace-nowrap truncate" : "break-words overflow-hidden"} min-w-0 max-w-full ${isExcluded ? "text-gray-400" : isNumeric && isOverBudget ? "text-gray-800" : isNumeric && isOnTrack ? "text-gray-500" : ""} text-[14px]`}
            style={isNameCol ? { fontWeight: 550, color: isExcluded ? "#9ca3af" : "#1e293b" } : isStatusCol ? { letterSpacing: "0.01em" } : undefined}
          >{cell.column.columnDef.cell
            ? (cell.column.columnDef.cell as any)(cell.getContext())
            : (cell.getValue() as any)}</span>
        </div>
      </td>
    )
  }

  useEffect(() => {
    if (!stickyHeaderRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setStickyHeaderHeight(entry.target.getBoundingClientRect().height)
    })
    ro.observe(stickyHeaderRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={scrollContainerRef}
      className="relative overflow-auto h-full enterprise-grid-scroll"
      style={{ backgroundColor: "#FFFFFF" }}
    >
      {/* Report control bar */}
      <div className="sticky left-0 flex flex-wrap items-end gap-[10px] px-[16px] pt-[8px] pb-[16px] bg-white relative" style={{ width: "100vw", maxWidth: "100%" }}>
        <div aria-hidden="true" className="absolute border-b border-[#005390] inset-0 pointer-events-none" />
        {(() => {
          const labelClass = "text-[11.5px] pl-[6px] mb-[1px] text-[#5a6178]"
          const fieldClass = "h-[42px] rounded-[6px] bg-white relative"
          const selectClass = "w-full h-full bg-transparent border-none outline-none cursor-pointer text-[14px] text-gray-900 pl-[12px] pr-[32px] appearance-none"
          const borderClass = "absolute inset-0 pointer-events-none rounded-[6px] border border-[#c0c5d4]"
          const chevron = <div className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[#8b90a0]"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>

          const renderControl = (
            label: string,
            value: string,
            onChange: (val: any) => void,
            options: { value: string; label: string }[],
            width: string = "w-[176px]"
          ) => (
            <div className={`${width} shrink-0 flex flex-col`}>
              <div className={labelClass} style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 700 }}>{label}</div>
              <div className={fieldClass}>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className={selectClass}
                  style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 600 }}
                >
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {chevron}
                <div aria-hidden="true" className={borderClass} />
              </div>
            </div>
          )

          return (
            <>
              {renderControl("Pivot By", pivotBy, onPivotByChange, [
                { value: "facility", label: "Facility" },
                { value: "glAccount", label: "GL Account" },
                { value: "vendor", label: "Vendor" },
              ])}
              {/* Timeframe control with date picker for Custom Range */}
              <div className="w-[176px] shrink-0 flex flex-col">
                <div className={labelClass} style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 700 }}>Timeframe</div>
                <DateRangePickerPopover
                  open={showDatePicker}
                  onOpenChange={setShowDatePicker}
                  startDate={customStart}
                  endDate={customEnd}
                  onRangeConfirm={(start, end) => {
                    setCustomStart(start)
                    setCustomEnd(end)
                  }}
                  onDismiss={() => {
                    // Revert to previous timeframe if user dismisses without completing a range
                    if (!(customStart && customEnd && timeframe === "customRange")) {
                      onTimeframeChange(prevTimeframe)
                    }
                  }}
                >
                  <div className={fieldClass}>
                    <select
                      value={timeframe}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "customRange" || val === "customRangeEdit") {
                          setPrevTimeframe(timeframe === "customRange" ? prevTimeframe : timeframe)
                          onTimeframeChange("customRange")
                          setShowDatePicker(true)
                        } else {
                          onTimeframeChange(val)
                          setShowDatePicker(false)
                        }
                      }}
                      className={selectClass}
                      style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 600 }}
                    >
                      <option value="last7Days">Last 7 Days</option>
                      <option value="last30Days">Last 30 Days</option>
                      <option value="monthToDate">Month to Date</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="quarterToDate">Quarter to Date</option>
                      <option value="lastQuarter">Last Quarter</option>
                      <option value="yearToDate">Year to Date</option>
                      <option value="last12Months">Last 12 Months</option>
                      <option value={timeframe === "customRange" ? "customRangeEdit" : "customRange"}>Custom Range</option>
                      {timeframe === "customRange" && customStart && customEnd && (
                        <option value="customRange">{`${formatDateRange(customStart, customEnd)} (Custom)`}</option>
                      )}
                    </select>
                    {chevron}
                    <div aria-hidden="true" className={borderClass} />
                  </div>
                </DateRangePickerPopover>
              </div>
              {renderControl("Breakdown By", viewBy, onViewByChange, [
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "fullTimeframe", label: "Full Timeframe" },
              ].filter(opt => {
                const validViewByMap: Record<string, string[]> = {
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
                return (validViewByMap[timeframe] || []).includes(opt.value)
              }))}
              {renderControl("Metric", metric, onMetricChange, [
                { value: "dollars", label: "Dollars" },
                { value: "ppd", label: "PPD" },
              ])}
              {renderControl("Spend Mode", spendMode, onSpendModeChange, [
                { value: "actual", label: "Actual" },
                { value: "commitment", label: "Commitment" },
                { value: "totalImpact", label: "Total Impact" },
              ])}
            </>
          )
        })()}
        <div className="flex-1 flex justify-end" style={{ minWidth: 160 }}>
          <div className="w-[160px] shrink-0 flex flex-col">
            <div className="text-[11.5px] pl-[6px] mb-[1px] text-[#5a6178]" style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 700 }}>Table Size</div>
            <div className="h-[42px] rounded-[6px] bg-white relative">
              <select
                value={density}
                onChange={(e) => setDensity(e.target.value as Density)}
                className="w-full h-full bg-transparent border-none outline-none cursor-pointer text-[14px] text-gray-700 pl-[12px] pr-[32px] appearance-none"
                style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 600 }}
              >
                <option value="comfortable">Comfortable</option>
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
              </select>
              <div className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-[#8b90a0]"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none rounded-[6px] border border-[#c0c5d4]" />
            </div>
          </div>
        </div>
      </div>
      {/* Scope + Breadcrumb */}
      <div ref={stickyHeaderRef} className="sticky top-0 left-0 z-50 bg-white px-4 py-1.5 border-b flex flex-col gap-0" style={{ width: "100vw", maxWidth: "100%" }}>
        <span className={`${breadcrumbPath.length > 1 ? "text-[17px]" : "text-[17px] text-gray-700"}`}>
          {breadcrumbPath.map((seg, i) => {
            const isLast = i === breadcrumbPath.length - 1
            const separator = i > 0 ? " / " : ""
            if (isLast) {
              // Current segment — non-clickable
              return (
                <span key={i}>
                  {separator}
                  <span className="text-gray-900" style={{ fontWeight: 600 }}>{seg.label}</span>
                </span>
              )
            }
            // Navigable ancestor segment
            return (
              <span key={i}>
                {separator}
                <span
                  className="cursor-pointer text-[#005390] hover:underline text-[17px]"
                  onClick={() => {
                    setSelectedRowName(null)
                    if (seg.viewId) {
                      onActiveViewIdChange(seg.viewId)
                    }
                  }}
                >
                  {seg.label}
                </span>
              </span>
            )
          })}
        </span>
        <span className="text-[#222834] text-[12px]">
          {scopeLabel} | {computeTimeLabel(timeframe as any, viewBy, (anchorDate && !isNaN(anchorDate.getTime())) ? anchorDate : FALLBACK_ANCHOR, customStart, customEnd)}
        </span>
      </div>
      {/* KPI summary row */}
      <div className="sticky left-0 flex items-start gap-8 px-4 py-2.5 bg-white border-b" style={{ width: "100vw", maxWidth: "100%" }}>
        {(() => {
          const isConnecting = viewState === "connecting" || viewState === "loading" || viewState === "error"

          // Vendor drill-down: operational KPI (no budget/variance)
          if (isVendorView) {
            const vendorCount = kpi.reconciliation?.rowCount ?? 0
            const avgPerVendor = vendorCount > 0 ? kpi.consumed / vendorCount : 0
            return [
              { label: "Total Spend", value: isConnecting ? "—" : formatKpiCurrency(kpi.consumed), fullValue: isConnecting ? undefined : formatKpiCurrencyFull(kpi.consumed), overage: false, status: "neutral" as const },
              { label: "Vendor Count", value: isConnecting ? "—" : vendorCount.toLocaleString("en-US"), fullValue: undefined, overage: false, status: "neutral" as const },
              { label: "Avg Spend / Vendor", value: isConnecting ? "—" : formatKpiCurrency(avgPerVendor), fullValue: isConnecting ? undefined : formatKpiCurrencyFull(avgPerVendor), overage: false, status: "neutral" as const },
            ]
          }

          const isPpd = metric === "ppd"
          const budgetLabel = isPpd ? "Budget PPD" : "Total Budget"
          const spendLabel = isPpd ? "Spend PPD" : "Total Spend"
          const varianceLabel = isPpd ? "Variance PPD" : "Total Variance"
          const varStatus = isConnecting ? "neutral" as const : kpi.percent < -5 ? "over" as const : kpi.percent > 5 ? "under" as const : "ontrack" as const
          return [
            { label: budgetLabel, value: isConnecting ? "—" : isPpd ? formatKpiPpd(kpi.budget) : formatKpiCurrency(kpi.budget), fullValue: isConnecting ? undefined : formatKpiCurrencyFull(kpi.budget), overage: false, status: "neutral" as const },
            { label: spendLabel, value: isConnecting ? "—" : isPpd ? formatKpiPpd(kpi.consumed) : formatKpiCurrency(kpi.consumed), fullValue: isConnecting ? undefined : formatKpiCurrencyFull(kpi.consumed), overage: false, status: "neutral" as const },
            { label: varianceLabel, value: isConnecting ? "—" : isPpd ? formatKpiPpd(kpi.variance) : formatKpiCurrency(kpi.variance), fullValue: isConnecting ? undefined : formatKpiCurrencyFull(kpi.variance), overage: !isConnecting && kpi.variance < 0, status: varStatus },
            { label: "Variance %", value: isConnecting ? "—" : `${Math.round(kpi.percent)}%`, fullValue: undefined, overage: !isConnecting && kpi.percent < 0, status: varStatus },
          ]
        })().map((card) => (
          <div key={card.label} className="flex flex-col">
            <div className="text-[11px] text-gray-400 mb-1">{card.label}</div>
            <div
              className={card.status === "over" ? "text-red-600" : card.status === "ontrack" ? "text-amber-600" : "text-gray-900"}
              style={{ fontSize: "1.05rem", fontWeight: card.status === "over" ? 650 : 600, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}
              title={card.fullValue}
            >{card.value}</div>
            {(card.label === "Total Spend" || card.label === "Spend PPD") && kpi.excludedSpend > 0 && (
              <div
                className="text-[10px] text-gray-400 mt-0.5 cursor-default"
                title="Spend not counted toward budget or variance"
              >
                Excluded: {metric === "dollars" ? formatKpiCurrency(kpi.excludedSpend) : formatKpiPpd(kpi.excludedSpend)}
              </div>
            )}
          </div>
        ))}
        {/* Person-days context when Metric = PPD */}
        {metric === "ppd" && (kpi.totalPersonDays ?? 0) > 0 && (
          <div className="flex items-end ml-2">
            <div className="text-[10px] text-gray-400 pb-0.5 cursor-default" title="Total person-days used as PPD denominator">
              Based on {Math.round(kpi.totalPersonDays!).toLocaleString("en-US")} person-days
              {/* Round 3.5: per-type breakdown when multi-type. Surfaces the
                  shared denominator's composition once in the header, where it
                  describes the actual PPD denominator governing every row's
                  math (instead of repeating identical breakdowns per row). */}
              {(() => {
                const byType = (kpi as any).personDaysByType as Record<string, number> | undefined
                if (!byType) return null
                const entries = Object.entries(byType).filter(([, pd]) => Number(pd) > 0)
                if (entries.length < 2) return null
                const order = ["AL", "IL", "SNF"]
                entries.sort(([a], [b]) => {
                  const ai = order.indexOf(a)
                  const bi = order.indexOf(b)
                  if (ai !== -1 && bi !== -1) return ai - bi
                  if (ai !== -1) return -1
                  if (bi !== -1) return 1
                  return a.localeCompare(b)
                })
                return (
                  <span className="ml-1">
                    · {entries.map(([t, pd], i) => (
                      <span key={t}>
                        {i > 0 && <span className="text-gray-300 mx-1">/</span>}
                        <span className="text-gray-500">{t}</span> {Math.round(Number(pd)).toLocaleString("en-US")}
                      </span>
                    ))}
                  </span>
                )
              })()}
              {kpi.projectionStatus === "ObservedAndProjected" && (
                <span className="text-amber-500 ml-1">(includes projected census)</span>
              )}
            </div>
            {/* Round 4c — GL applicability note. Per directive, surfaces the
                aggregate vs row denominator distinction when any visible row
                uses GL applicability. Hidden in pure facility/vendor views
                where all rows are full_scope. */}
            {hasAnyGlScopedRow && (
              <div className="text-[10px] text-gray-400 pb-0.5 cursor-default italic ml-3 leading-tight" style={{ maxWidth: 380 }}>
                Aggregate PPD uses the full selected census scope. GL row PPD may use a narrower denominator based on GL census applicability.
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ backgroundColor: "#F5F7FA" }}>
      <table
        className="border-separate bg-white"
        style={{ width: table.getTotalSize(), marginLeft: 0, marginRight: 0, tableLayout: "fixed", borderSpacing: 0, borderCollapse: "separate" }}
      >
        <colgroup>
          {table.getAllLeafColumns().map((col) => (
            <col key={col.id} style={{ width: col.getSize() }} />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(renderHeaderCell)}
            </tr>
          ))}
        </thead>

        {viewState === "loading" ? (
          <tbody>
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className="px-4 py-12 text-center"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-[2.5px] border-gray-200" />
                    <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-[#005390] animate-spin" />
                  </div>
                  <div className="text-[13px] text-gray-500">Loading view…</div>
                  <ElapsedTimer />
                </div>
              </td>
            </tr>
          </tbody>
        ) : viewState === "empty" ? (
          <tbody>
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className="px-4 py-8 text-center text-gray-500"
              >
                <div>No results found for the current scope.</div>
                <div className="mt-1">Try changing your filters or returning to a higher level.</div>
              </td>
            </tr>
          </tbody>
        ) : viewState === "error" ? (
          <tbody>
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className="px-4 py-8 text-center text-gray-500"
              >
                <div className="font-medium text-gray-700">Unable to load data from Supabase</div>
                <div className="mt-1 text-[13px]">Check your connection and try again.</div>
                {serverError && (
                  <div className="mt-2 text-[11px] font-mono text-red-500 max-w-lg mx-auto break-all">{serverError}</div>
                )}
                {failedViewId && (
                  <div className="mt-1 text-[11px] font-mono text-gray-400">viewId: {failedViewId}</div>
                )}
                {onRetry && (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="px-4 py-1.5 rounded-[6px] text-white cursor-pointer text-[13px]"
                      style={{ backgroundColor: "#005390", border: "none", font: "inherit" }}
                      onClick={onRetry}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {breadcrumbPath.length > 1 && (
                  <div className="mt-2 text-[12px]">
                    Or use the breadcrumb above to navigate back.
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        ) : viewState === "connecting" ? (
          <tbody>
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className="px-4 py-16 text-center"
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Spinner */}
                  <div className="relative w-10 h-10">
                    <div
                      className="absolute inset-0 rounded-full border-[3px] border-gray-200"
                    />
                    <div
                      className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#005390] animate-spin"
                    />
                  </div>
                  <div>
                    <div className="text-[15px] text-gray-700" style={{ fontWeight: 600, fontFamily: "'Nunito Sans', sans-serif" }}>
                      Connecting to database
                    </div>
                    <div className="text-[13px] text-gray-400 mt-1">
                      Aggregating live data from BVS tables — this may take a moment on first load
                    </div>
                    <ElapsedTimer />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        ) : (
        <tbody
          style={{
            backgroundColor: "#FFFFFF",
          }}
        >
          {/* Top spacer for virtualization */}
          {rowVirtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
              <td colSpan={table.getAllLeafColumns().length} style={{ padding: 0, border: 'none' }} />
            </tr>
          )}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            const visibleCells = row.getVisibleCells()

            // Determine row status for exception emphasis
            const rowData = row.original as any
            const rowStatus = rowData._status as string | undefined
            const isOverBudget = rowStatus === "over_budget"
            const isOnTrack = rowStatus === "on_track"
            const rowBg = isOverBudget
              ? "bg-red-50/50"
              : isOnTrack
              ? "bg-amber-50/30"
              : ""

            const isExcludedRow = rowStatus === "excluded"

            // Detect "first excluded row" to render separator
            const prevRow = virtualRow.index > 0 ? rows[virtualRow.index - 1] : null
            const prevStatus = prevRow ? (prevRow.original as any)?._status : null
            const isFirstExcluded = isExcludedRow && prevStatus !== "excluded"

            const drillClass = (() => {
              const childViewId = rowData.childViewId
              return childViewId ? "group hover:bg-blue-50/60 cursor-pointer transition-colors duration-150" : "select-none"
            })()

            return (
              <React.Fragment key={row.id}>
                {isFirstExcluded && (
                  <tr key={`excluded-sep-${row.id}`}>
                    <td
                      colSpan={visibleCells.length}
                      className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 bg-gray-50 border-b border-gray-200 uppercase tracking-wide"
                      style={{ borderTop: "2px solid #e5e7eb" }}
                    >
                      Excluded items
                    </td>
                  </tr>
                )}
              <tr
                key={row.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className={`${rowBg} ${drillClass}`}
                style={{
                  minHeight: MIN_ROW_HEIGHT,
                }}
                onClick={(() => {
                  const childViewId = rowData.childViewId
                  const name = rowData.name
                  if (!childViewId) return undefined
                  return () => {
                    setSelectedRowName(name)
                    emitAudit({ type: "DRILL_DOWN", target: name, metadata: { childViewId } })
                    onActiveViewIdChange(childViewId)
                  }
                })()}
              >
                {visibleCells.map((cell: any) => renderBodyCell(cell))}
              </tr>
              </React.Fragment>
            )
          })}
          {/* Bottom spacer for virtualization */}
          {rowVirtualizer.getVirtualItems().length > 0 && (
            <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end) }}>
              <td colSpan={table.getAllLeafColumns().length} style={{ padding: 0, border: 'none' }} />
            </tr>
          )}
        </tbody>
        )}
      </table>
      </div>
    </div>
  )
}