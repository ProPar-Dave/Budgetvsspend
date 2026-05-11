import { useState, useRef } from "react"

export type SparklinePoint = {
  month: string
  spend: number | null
  budget: number
}

type Props = {
  data: SparklinePoint[]
  width?: number
  height?: number
  status?: "over" | "on-track" | "under"
}

function formatCurrency(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}

export function Sparkline({ data, width = 80, height = 24, status = "under" }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: SparklinePoint } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (!data || data.length === 0) {
    return <div style={{ width, height }} className="flex items-center justify-center text-gray-300 text-[9px]">--</div>
  }

  const pad = { top: 2, bottom: 2, left: 1, right: 1 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  // Collect all values for Y-axis scaling (spend + budget)
  const spendValues = data.map(d => d.spend).filter((v): v is number => v !== null)
  const budgetValues = data.map(d => d.budget).filter(v => v > 0)
  const allValues = [...spendValues, ...budgetValues]

  if (allValues.length === 0) {
    return <div style={{ width, height }} className="flex items-center justify-center text-gray-300 text-[9px]">--</div>
  }

  const yMin = Math.min(...allValues)
  const yMax = Math.max(...allValues)
  const yRange = yMax - yMin || 1 // avoid div by zero

  // Map a value to Y coordinate (inverted — higher values are closer to top)
  const toY = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH
  const toX = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * plotW

  // Build spend line path segments (break at nulls)
  const spendSegments: string[] = []
  let currentSegment: string[] = []
  data.forEach((d, i) => {
    if (d.spend !== null) {
      const x = toX(i).toFixed(1)
      const y = toY(d.spend).toFixed(1)
      if (currentSegment.length === 0) {
        currentSegment.push(`M${x},${y}`)
      } else {
        currentSegment.push(`L${x},${y}`)
      }
    } else {
      if (currentSegment.length > 0) {
        spendSegments.push(currentSegment.join(" "))
        currentSegment = []
      }
    }
  })
  if (currentSegment.length > 0) spendSegments.push(currentSegment.join(" "))

  // Budget average line (dashed horizontal)
  const avgBudget = budgetValues.length > 0
    ? budgetValues.reduce((s, v) => s + v, 0) / budgetValues.length
    : 0
  const budgetY = avgBudget > 0 ? toY(avgBudget) : null

  const spendColor = status === "over" ? "#dc2626" : status === "on-track" ? "#d97706" : "#16a34a" // red-600 / amber-600 / green-600

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    // Find closest data point
    const idx = Math.round(((mx - pad.left) / plotW) * (data.length - 1))
    const clampedIdx = Math.max(0, Math.min(data.length - 1, idx))
    const point = data[clampedIdx]
    if (point) {
      setTooltip({ x: e.clientX, y: e.clientY, point })
    }
  }

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Budget average dashed line */}
        {budgetY !== null && (
          <line
            x1={pad.left}
            y1={budgetY}
            x2={width - pad.right}
            y2={budgetY}
            stroke="#9ca3af"
            strokeWidth={0.75}
            strokeDasharray="2,2"
          />
        )}
        {/* Spend line segments */}
        {spendSegments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={spendColor}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[200] pointer-events-none bg-gray-900 text-white text-[10px] leading-tight px-2 py-1.5 rounded shadow-lg"
          style={{ left: tooltip.x + 10, top: tooltip.y - 40 }}
        >
          <div className="font-medium mb-0.5">{tooltip.point.month}</div>
          {tooltip.point.spend !== null && (
            <div>Spend: {formatCurrency(tooltip.point.spend)}</div>
          )}
          {tooltip.point.budget > 0 && (
            <div>Budget: {formatCurrency(tooltip.point.budget)}</div>
          )}
          {tooltip.point.spend === null && (
            <div className="text-gray-400">No data</div>
          )}
        </div>
      )}
    </div>
  )
}