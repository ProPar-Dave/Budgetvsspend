/**
 * Timeframe utilities — computes date ranges anchored to the latest transaction date
 * in the dataset, NOT to the current wall-clock time.
 */

export type Timeframe =
  | "last7Days" | "last30Days" | "monthToDate" | "lastMonth"
  | "quarterToDate" | "lastQuarter" | "yearToDate" | "last12Months"
  | "customRange"

export type DateRange = { start: Date; end: Date }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * Compute the date range for a given timeframe, anchored to `anchor`.
 * `anchor` should be MAX(txn_date) from the dataset.
 */
export function getTimeframeRange(
  timeframe: Timeframe,
  anchor: Date,
  customStart?: Date | null,
  customEnd?: Date | null,
): DateRange {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const d = anchor.getDate()

  switch (timeframe) {
    case "last7Days": {
      const start = new Date(y, m, d - 6)
      return { start, end: anchor }
    }
    case "last30Days": {
      const start = new Date(y, m, d - 29)
      return { start, end: anchor }
    }
    case "monthToDate":
      return { start: new Date(y, m, 1), end: anchor }
    case "lastMonth": {
      const lastMonthEnd = new Date(y, m, 0) // last day of previous month
      const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1)
      return { start: lastMonthStart, end: lastMonthEnd }
    }
    case "quarterToDate": {
      const qStart = Math.floor(m / 3) * 3
      return { start: new Date(y, qStart, 1), end: anchor }
    }
    case "lastQuarter": {
      const curQStart = Math.floor(m / 3) * 3
      const lqEnd = new Date(y, curQStart, 0) // last day before current quarter
      const lqStart = new Date(lqEnd.getFullYear(), Math.floor(lqEnd.getMonth() / 3) * 3, 1)
      return { start: lqStart, end: lqEnd }
    }
    case "yearToDate":
      return { start: new Date(y, 0, 1), end: anchor }
    case "last12Months": {
      const start = new Date(y - 1, m, d + 1)
      return { start, end: anchor }
    }
    case "customRange":
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd }
      }
      // fallback: month to date
      return { start: new Date(y, m, 1), end: anchor }
  }
}

/** Format a date as "Dec 28, 2025" */
export function fmtDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/** Format a date as "Dec 2025" */
export function fmtMonth(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Format a date as "Q4 2025" */
export function fmtQuarter(d: Date): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
}

/**
 * Build a human-readable label for the active time context.
 */
export function getTimeContextLabel(
  timeframe: Timeframe,
  viewBy: string,
  anchor: Date,
  customStart?: Date | null,
  customEnd?: Date | null,
): string {
  const range = getTimeframeRange(timeframe, anchor, customStart, customEnd)
  const { start: s, end: e } = range

  if (viewBy === "monthly") return `${fmtMonth(s)} \u2013 ${fmtMonth(e)}`
  if (viewBy === "quarterly") return `${fmtQuarter(s)} \u2013 ${fmtQuarter(e)}`
  if (viewBy === "weekly") return `Weeks of ${fmtDate(s)} \u2013 ${fmtDate(e)}`
  // daily, fullTimeframe, or anything else
  return `${fmtDate(s)} \u2013 ${fmtDate(e)}`
}

/** Default anchor fallback (used when no DB anchor is available) */
export const FALLBACK_ANCHOR = new Date(2025, 11, 28) // Dec 28, 2025
