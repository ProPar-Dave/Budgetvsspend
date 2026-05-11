import { useState, useEffect } from "react"
import { Calendar } from "./ui/calendar"
import { Popover, PopoverContent, PopoverAnchor } from "./ui/popover"
import type { DateRange } from "react-day-picker"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function formatDateRange(start: Date, end: Date): string {
  return `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} - ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
}

type DateRangePickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  startDate: Date | null
  endDate: Date | null
  onRangeConfirm: (start: Date, end: Date) => void
  onDismiss: () => void
  children: React.ReactNode
}

export function DateRangePickerPopover({ open, onOpenChange, startDate, endDate, onRangeConfirm, onDismiss, children }: DateRangePickerProps) {
  const [range, setRange] = useState<DateRange | undefined>(
    startDate && endDate ? { from: startDate, to: endDate } : undefined
  )

  // Reset internal range state when popover opens
  useEffect(() => {
    if (open) {
      setRange(startDate && endDate ? { from: startDate, to: endDate } : undefined)
    }
  }, [open])

  const canConfirm = !!(range?.from && range?.to)

  function handleSelect(newRange: DateRange | undefined) {
    setRange(newRange)
  }

  function handleConfirm() {
    if (range?.from && range?.to) {
      onRangeConfirm(range.from, range.to)
      onOpenChange(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onDismiss()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        {children}
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          defaultMonth={startDate ?? new Date(2025, 11)}
          numberOfMonths={2}
        />
        <div className="flex items-center justify-end gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="px-3 py-1.5 text-[13px] text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
            style={{ fontFamily: "'Nunito Sans', sans-serif", fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="px-4 py-1.5 text-[13px] text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontFamily: "'Nunito Sans', sans-serif",
              fontWeight: 600,
              backgroundColor: canConfirm ? "#005390" : "#005390",
            }}
          >
            Confirm
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}