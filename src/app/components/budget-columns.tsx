import { createColumnHelper } from "@tanstack/react-table"
import { Sparkline } from "./sparkline"
import type { SparklinePoint } from "./sparkline"

const col = createColumnHelper<any>()

// Deterministic tie-breaker: when primary sort values are equal, fall back to label ASC (case-insensitive)
function withLabelTieBreaker(compareFn: (rowA: any, rowB: any, columnId: string) => number) {
  return (rowA: any, rowB: any, columnId: string) => {
    const result = compareFn(rowA, rowB, columnId)
    if (result !== 0) return result
    const labelA = (rowA.original.name ?? "").toLowerCase()
    const labelB = (rowB.original.name ?? "").toLowerCase()
    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0
  }
}

// ---------------------------------------------------------------------------
// Smart currency formatting — abbreviated display, full tooltip on hover
// ---------------------------------------------------------------------------

/** Full-precision display: "$39,711,380.65" — used for hover tooltips */
function formatCurrencyFull(value: number): string {
  const abs = Math.abs(value)
  const formatted = "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return value < 0 ? "-" + formatted : formatted
}

/** Abbreviated display: "$39.71M" — guaranteed to never truncate in column */
export function formatCurrencyAbbrev(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

/** PPD display: "$XXX.XX" — no abbreviation, values typically $100-$300 range */
function formatPpd(value: number): string {
  const abs = Math.abs(value)
  const formatted = "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return value < 0 ? "-" + formatted : formatted
}

const TABULAR_NUMS: React.CSSProperties = { fontVariantNumeric: "tabular-nums" }

/** Render a currency/PPD value with appropriate formatting */
function CurrencyCell({ value, isPpd }: { value: number; isPpd?: boolean }) {
  if (isPpd) {
    return (
      <span title={formatPpd(value)} style={TABULAR_NUMS}>
        {formatPpd(value)}
      </span>
    )
  }
  return (
    <span title={formatCurrencyFull(value)} style={TABULAR_NUMS}>
      {formatCurrencyAbbrev(value)}
    </span>
  )
}

export function budgetColumns(metric: "dollars" | "ppd" = "dollars", nameHeader: string = "Name", showPeriod: boolean = false, showTransactionCols: boolean = false, onTransactionClick?: (label: string) => void, isVendorView: boolean = false, sparklineData?: Record<string, any[]> | null) {
  const isPpd = metric === "ppd"
  const suffix = isPpd ? " (PPD)" : ""
  const isFacilityView = nameHeader === "Facilities"

  const cols: any[] = []

  if (!showTransactionCols) {
    cols.push(
      col.accessor("name", {
        header: nameHeader,
        size: 220,
        minSize: 140,
      })
    )
  }

  if (showTransactionCols) {
    cols.push(
      col.accessor(
        (row: any) => {
          if (row.txnType === "MANUAL_ACCRUAL") return row.name ?? "Manual Accrual"
          const po = row.po ?? "No PO"
          const inv = row.invoice ?? "No Invoice"
          return `${po} • ${inv}`
        },
        {
          id: "transactions",
          header: "Transactions",
          size: 240,
          minSize: 180,
          enableColumnFilter: true,
          filterFn: (row: any, columnId: string, filterValue: any) => {
            const val = (row.getValue(columnId) as string) ?? ""
            return val.toLowerCase().includes(String(filterValue ?? "").toLowerCase())
          },
          enableSorting: true,
          cell: (info: any) => {
            const txnType = info.row.original.txnType
            const po = info.row.original.po
            const inv = info.row.original.invoice

            // Manual accrual: single clickable label
            if (txnType === "MANUAL_ACCRUAL") {
              const accrualLabel = info.row.original.name ?? "Manual Accrual"
              return (
                <span
                  className="underline cursor-pointer"
                  style={{ color: "#005390" }}
                  onClick={(e) => { e.stopPropagation(); onTransactionClick?.(`ACCRUAL:${accrualLabel}`) }}
                >{accrualLabel}</span>
              )
            }

            // PO / Invoice display
            const poText = po ?? "No PO"
            const invText = inv ?? "No Invoice"
            const label = `${poText} • ${invText}`
            return (
              <span>
                {po ? (
                  <span
                    className="underline cursor-pointer"
                    style={{ color: "#005390" }}
                    onClick={(e) => { e.stopPropagation(); onTransactionClick?.(label) }}
                  >{poText}</span>
                ) : (
                  <span className="text-gray-400">{poText}</span>
                )}
                <span className="text-gray-300 mx-1">•</span>
                {inv ? (
                  <span
                    className="underline cursor-pointer"
                    style={{ color: "#005390" }}
                    onClick={(e) => { e.stopPropagation(); onTransactionClick?.(label) }}
                  >{invText}</span>
                ) : (
                  <span className="text-gray-400">{invText}</span>
                )}
              </span>
            )
          },
        }
      )
    )
  }

  if (showPeriod) {
    cols.push(
      col.accessor("period", {
        header: "Period",
        size: 140,
        minSize: 100,
        enableColumnFilter: true,
        filterFn: (row: any, columnId: string, filterValue: string) => {
          const val = (row.getValue(columnId) as string) ?? ""
          return val.toLowerCase().includes((filterValue as string).toLowerCase())
        },
        enableSorting: true,
      })
    )
  }

  // Vendor drill-down: operational columns (no budget/variance)
  if (isVendorView) {
    cols.push(
      col.accessor("consumed", {
        header: `Total Spend${suffix}`,
        meta: { numeric: true },
        size: 140,
        minSize: 90,
        cell: (info: any) => <CurrencyCell value={info.getValue() ?? 0} isPpd={isPpd} />,
        sortingFn: withLabelTieBreaker((rowA: any, rowB: any, columnId: string) => {
          const a = (rowA.getValue(columnId) as number) ?? 0
          const b = (rowB.getValue(columnId) as number) ?? 0
          return a - b
        }),
      }),

      col.accessor("txnCount", {
        header: "Txn Count",
        meta: { numeric: true },
        size: 100,
        minSize: 70,
        cell: (info: any) => {
          const val = info.getValue()
          return val != null ? <span style={TABULAR_NUMS}>{val.toLocaleString("en-US")}</span> : "--"
        },
        sortingFn: withLabelTieBreaker((rowA: any, rowB: any, columnId: string) => {
          const a = (rowA.getValue(columnId) as number) ?? 0
          const b = (rowB.getValue(columnId) as number) ?? 0
          return a - b
        }),
      }),
    )

    // Avg Transaction and Last Transaction are dollar/date concepts —
    // hide them in PPD mode (doctrine: PPD is per-patient-day, not per-txn).
    if (!isPpd) {
      cols.push(
        col.accessor("avgTransaction", {
          header: "Avg Transaction",
          meta: { numeric: true },
          size: 130,
          minSize: 90,
          cell: (info: any) => {
            const val = info.getValue()
            return val != null ? <CurrencyCell value={val} /> : "--"
          },
          sortingFn: withLabelTieBreaker((rowA: any, rowB: any, columnId: string) => {
            const a = (rowA.getValue(columnId) as number) ?? 0
            const b = (rowB.getValue(columnId) as number) ?? 0
            return a - b
          }),
        }),

        col.accessor("lastTxnDate", {
          header: "Last Transaction",
          size: 130,
          minSize: 100,
          cell: (info: any) => {
            const val = info.getValue()
            if (!val) return "--"
            const [y, m, d] = val.split("-").map(Number)
            const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            return `${MONTHS[m - 1]} ${d}, ${y}`
          },
          enableSorting: true,
          sortingFn: withLabelTieBreaker((rowA: any, rowB: any, columnId: string) => {
            const a = rowA.getValue(columnId) ?? ""
            const b = rowB.getValue(columnId) ?? ""
            return a < b ? -1 : a > b ? 1 : 0
          }),
        }),
      )
    }
    // Vendor trend sparkline (spend only, no budget baseline)
    if (sparklineData && !showPeriod) {
      cols.push(
        col.display({
          id: "trend",
          header: "Trend",
          size: 96,
          minSize: 80,
          enableSorting: false,
          cell: (info: any) => {
            const entityId = info.row.original._entityId
            const points: SparklinePoint[] | undefined = entityId ? sparklineData[entityId] : undefined
            if (!points || points.length === 0) return <span className="text-gray-300 text-[9px]">--</span>
            return <Sparkline data={points} width={80} height={24} status="under" />
          },
        })
      )
    }
    return cols
  }

  cols.push(
    col.accessor("budget", {
      header: `Budget${suffix}`,
      meta: { editable: true, numeric: true, groupStart: true },
      size: 110,
      minSize: 80,
      cell: info => {
        const row = info.row.original
        if (row.excluded) return <span className="text-gray-400">--</span>
        // Round 4c: `—` (em dash) means "not applicable" — engine emitted
        // null PPD because no census denominator applies (overhead GL, or
        // applicable types ∩ scope yields zero person-days). Distinct from
        // `$0.00` which means "applicable but zero".
        if (isPpd && row._ppdNull) return <span className="text-gray-400" title="No census denominator applies to this row">—</span>
        const budget = info.getValue() ?? 0
        // In dollars mode, $0 budget → `--` (no allocation). In PPD mode,
        // applicable-but-zero falls through to CurrencyCell which renders
        // `$0.00` per directive.
        if (budget === 0 && !isPpd) return <span className="text-gray-400">--</span>
        return <CurrencyCell value={budget} isPpd={isPpd} />
      },
      sortingFn: withLabelTieBreaker((rowA, rowB, columnId) => {
        const a = (rowA.getValue(columnId) as number) ?? 0
        const b = (rowB.getValue(columnId) as number) ?? 0
        return a - b
      }),
    }),

    col.accessor("consumed", {
      header: `Spend${suffix}`,
      meta: { editable: true, numeric: true },
      size: 130,
      minSize: 80,
      cell: info => {
        const row = info.row.original
        if (isPpd && row._ppdNull) return <span className="text-gray-400" title="No census denominator applies to this row">—</span>
        return <CurrencyCell value={info.getValue() ?? 0} isPpd={isPpd} />
      },
      sortingFn: withLabelTieBreaker((rowA, rowB, columnId) => {
        const a = (rowA.getValue(columnId) as number) ?? 0
        const b = (rowB.getValue(columnId) as number) ?? 0
        return a - b
      }),
    }),

    col.accessor("variance", {
      header: `Variance${suffix}`,
      meta: { numeric: true },
      size: 160,
      minSize: 110,
      cell: info => {
        const row = info.row.original
        if (row.excluded) return <span className="text-gray-400">--</span>
        if (isPpd && row._ppdNull) return <span className="text-gray-400" title="No census denominator applies to this row">—</span>
        const budget = row.budget ?? 0
        if (budget === 0 && !isPpd) return <span className="text-gray-400">--</span>
        return <CurrencyCell value={info.getValue() ?? 0} isPpd={isPpd} />
      },
      sortingFn: withLabelTieBreaker((rowA, rowB, columnId) => {
        const a = (rowA.getValue(columnId) as number) ?? 0
        const b = (rowB.getValue(columnId) as number) ?? 0
        return a - b
      }),
    }),

    col.accessor(
      (row) => {
        return row.variancePercent ?? null
      },
      {
        id: "variancePercent",
        header: `%`,
        meta: { numeric: true, groupEnd: true },
        size: 80,
        minSize: 60,
        cell: info => {
          const row = info.row.original
          if (row.excluded) return <span className="text-gray-400">--</span>
          const val = info.getValue()
          if (val === null || val === undefined) return "--"
          return <span style={TABULAR_NUMS}>{Math.round(val)}%</span>
        },
        sortingFn: withLabelTieBreaker((rowA, rowB, columnId) => {
          const a = rowA.getValue<number | null>(columnId) ?? 0
          const b = rowB.getValue<number | null>(columnId) ?? 0
          return a - b
        }),
        enableSorting: true,
      }
    ),
  )

  // Census column — PPD metric only. Round 4c: shown on all PPD drills (was
  // gated to facility-pivot in Round 3.5). Round 4d: removed the dead
  // "not_applicable" branch — every GL now has applicable types per the
  // governance correction. Cell renders one of two forms based on
  // row._ppdCalculationBasis (emitted by v72+ engine):
  //
  //   - "gl_applicability" — only applicable types from _personDaysByType,
  //     subtle scoped indicator (italicized type labels), tooltip itemizes
  //     included/excluded types + person-days per directive format. Edge case:
  //     applicable types ∩ facility types = 0 → render `—` with the same
  //     directive-format tooltip (the Included/Excluded breakdown explains).
  //   - "full_scope" or undefined — current Round 3 stacked-type rendering
  //     (full breakdown, no narrowing).
  //
  // Per governance: _personDaysByType is the FULL scoped breakdown — never
  // mutated. Filtering happens only at render. Tooltip always able to
  // surface the full breakdown.
  if (!showTransactionCols && isPpd) {
    cols.push(
      col.accessor("censusValue", {
        header: "Census",
        meta: { numeric: true },
        size: 130,
        minSize: 90,
        enableSorting: true,
        cell: (info: any) => {
          const row = info.row.original
          const basis: "full_scope" | "gl_applicability" | undefined =
            row._ppdCalculationBasis
          const censusBasisKind = row.censusBasis
          const projectedSuffix = censusBasisKind === "PROJECTED" ? "P" : ""
          const byType: Record<string, number> | null | undefined = row._personDaysByType
          const applicable: string[] | null | undefined = row._applicableCensusTypes
          const nonApplicablePD: number = Number(row._nonApplicablePersonDays ?? 0)

          // Stable AL/IL/SNF ordering helper.
          const TYPE_ORDER = ["AL", "IL", "SNF"]
          const sortTypes = (a: string, b: string) => {
            const ai = TYPE_ORDER.indexOf(a)
            const bi = TYPE_ORDER.indexOf(b)
            if (ai !== -1 && bi !== -1) return ai - bi
            if (ai !== -1) return -1
            if (bi !== -1) return 1
            return a.localeCompare(b)
          }
          const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

          // ---- Branch 1: gl_applicability → filtered types + scoped indicator. ----
          if (basis === "gl_applicability" && byType && Array.isArray(applicable)) {
            const includedEntries: Array<[string, number]> = applicable
              .map((t: string) => [t, Number(byType[t] ?? 0)] as [string, number])
              .filter(([, pd]) => pd > 0)
              .sort(([a], [b]) => sortTypes(a, b))
            const allTypes = Object.keys(byType).sort(sortTypes)
            const excludedTypes = allTypes.filter(t => !applicable.includes(t) && Number(byType[t]) > 0)
            const includedSum = includedEntries.reduce((a, [, pd]) => a + pd, 0)
            // Directive tooltip format — explicit Included/Excluded sections.
            const tooltip = [
              "PPD denominator basis",
              `Included: ${applicable.join(" + ") || "(none)"}`,
              `Included person-days: ${fmt(includedSum)}`,
              excludedTypes.length > 0
                ? `Excluded: ${excludedTypes.join(" + ")}`
                : "Excluded: (none)",
              `Excluded person-days: ${fmt(nonApplicablePD)}`,
            ].join("\n")

            if (includedEntries.length === 0) {
              // Edge case: applicable types exist but in-scope PD for them is 0
              // (Alderwood-AL × SNF-only GL). Render em dash + tooltip.
              return (
                <span className="text-gray-400" style={TABULAR_NUMS} title={tooltip}>
                  —
                </span>
              )
            }
            if (includedEntries.length === 1) {
              // Single applicable type with PD > 0 — single-line render.
              const [type, pd] = includedEntries[0]
              return (
                <span style={TABULAR_NUMS} title={tooltip} className="cursor-help">
                  <span className="text-gray-500 italic mr-1">{type}</span>
                  {fmt(pd)}
                  {projectedSuffix && <span className="text-gray-400 text-[10px] ml-0.5">{projectedSuffix}</span>}
                </span>
              )
            }
            // Multi-type — stacked render, italicized type labels signal scoped.
            return (
              <span style={TABULAR_NUMS} title={tooltip} className="cursor-help">
                <span className="flex flex-col items-end leading-tight">
                  {includedEntries.map(([type, pd]) => (
                    <span key={type} className="text-[12px]">
                      <span className="text-gray-500 italic mr-1">{type}</span>
                      {fmt(pd)}
                    </span>
                  ))}
                </span>
                {projectedSuffix && <span className="text-gray-400 text-[10px] ml-0.5">{projectedSuffix}</span>}
              </span>
            )
          }

          // ---- Branch 2: full_scope (or legacy/undefined basis). ----
          const val = info.getValue()
          if (val == null) return <span className="text-gray-300">--</span>
          const nonZeroTypes = byType
            ? Object.entries(byType).filter(([, pd]) => Number(pd) > 0)
            : []
          if (nonZeroTypes.length > 1) {
            nonZeroTypes.sort(([a], [b]) => sortTypes(a, b))
            const fullSum = nonZeroTypes.reduce((a, [, pd]) => a + Number(pd), 0)
            const tooltip = [
              "PPD denominator basis",
              `Full scope: ${nonZeroTypes.map(([t]) => t).join(" + ")}`,
              `Person-days: ${fmt(fullSum)}`,
            ].join("\n")
            return (
              <span style={TABULAR_NUMS} title={tooltip}>
                <span className="flex flex-col items-end leading-tight">
                  {nonZeroTypes.map(([type, pd]) => (
                    <span key={type} className="text-[12px]">
                      <span className="text-gray-500 mr-1">{type}</span>
                      {fmt(Number(pd))}
                    </span>
                  ))}
                </span>
                {projectedSuffix && <span className="text-gray-400 text-[10px] ml-0.5">{projectedSuffix}</span>}
              </span>
            )
          }
          return (
            <span
              style={TABULAR_NUMS}
              title={censusBasisKind === "PROJECTED" ? "Projected census" : "Actual census"}
            >
              {fmt(Number(val))}
              {projectedSuffix && <span className="text-gray-400 text-[10px] ml-0.5">{projectedSuffix}</span>}
            </span>
          )
        },
        sortingFn: withLabelTieBreaker((rowA: any, rowB: any, columnId: string) => {
          const a = (rowA.getValue(columnId) as number) ?? 0
          const b = (rowB.getValue(columnId) as number) ?? 0
          return a - b
        }),
      })
    )
  }

  // Trend sparkline column — between Census/Variance % and Status
  if (sparklineData && !showTransactionCols && !showPeriod) {
    cols.push(
      col.display({
        id: "trend",
        header: "Trend",
        size: 96,
        minSize: 80,
        enableSorting: false,
        cell: (info: any) => {
          const entityId = info.row.original._entityId
          const points: SparklinePoint[] | undefined = entityId ? sparklineData[entityId] : undefined
          if (!points || points.length === 0) return <span className="text-gray-300 text-[9px]">--</span>
          // Derive sparkline color from variancePercent for consistency with status column
          const vp = info.row.original.variancePercent as number | null | undefined
          const sparkStatus = (vp !== null && vp !== undefined && vp < -5) ? "over" as const
            : (vp !== null && vp !== undefined && vp > 5) ? "under" as const
            : "on-track" as const
          return <Sparkline data={points} width={80} height={24} status={sparkStatus} />
        },
      })
    )
  }

  cols.push(
    col.accessor(
      (row: any) => {
        // Derive status from variancePercent so it always agrees with the displayed % column
        if (row.excluded) return "Excluded"
        const vp = row.variancePercent
        if (vp === null || vp === undefined) return "Excluded"
        if (vp < -5) return "Over Budget"
        if (vp > 5) return "Under Budget"
        return "On Track"
      },
      {
        id: "status",
        header: "Status",
        size: 150,
        minSize: 120,
        enableColumnFilter: true,
        filterFn: (row: any, columnId: string, filterValue: any) => {
          const val = (row.getValue(columnId) as string) ?? ""
          return val.toLowerCase().includes(String(filterValue ?? "").toLowerCase())
        },
        enableSorting: true,
        cell: (info: any) => {
          const val = info.getValue() as string
          if (val === "Excluded") {
            return <span className="text-gray-400">Excluded</span>
          }
          if (val === "Over Budget") {
            return <span className="text-red-700" style={{ fontWeight: 600 }}>Over Budget</span>
          }
          if (val === "On Track") {
            return <span className="text-amber-600" style={{ fontWeight: 600 }}>On Track</span>
          }
          if (val === "Under Budget") {
            return <span className="text-green-600/80">Under Budget</span>
          }
          return null
        },
        sortingFn: withLabelTieBreaker((rowA: any, rowB: any, _columnId: string) => {
          const getOrder = (row: any) => {
            const vp = row.variancePercent
            if (vp === null || vp === undefined || row.excluded) return 3 // excluded
            if (vp < -5) return 0 // over budget
            if (vp > 5) return 2 // under budget
            return 1 // on track
          }
          return getOrder(rowA.original) - getOrder(rowB.original)
        }),
      },
    ),
  )

  return cols
}