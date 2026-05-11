import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
} from "@tanstack/react-table"

export type GridState = {
  sorting: any[]
  columnVisibility: Record<string, boolean>
  columnPinning: { left?: string[]; right?: string[] }
  columnSizing: Record<string, number>
  columnSizingInfo: any
  columnFilters: any[]
}

export function useEnterpriseGrid<T>(
  data: T[],
  columns: ColumnDef<T, any>[],
  state: GridState,
  onStateChange: (state: GridState) => void
) {
  // Derive the set of valid column IDs to prevent stale state references
  const columnIds = new Set(columns.map((c: any) => c.id ?? c.accessorKey ?? ""))

  const safeFilters = state.columnFilters.filter((f: any) => columnIds.has(f.id))
  const safeSorting = state.sorting.filter((s: any) => columnIds.has(s.id))

  return useReactTable({
    data,
    columns,
    state: {
      sorting: safeSorting,
      columnVisibility: state.columnVisibility,
      columnPinning: state.columnPinning,
      columnSizing: state.columnSizing,
      columnSizingInfo: state.columnSizingInfo,
      columnFilters: safeFilters,
    },
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: {
      minSize: 120,
      maxSize: 600,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.sorting) : updater
      onStateChange({ ...state, sorting: next })
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.columnVisibility) : updater
      onStateChange({ ...state, columnVisibility: next })
    },
    onColumnPinningChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.columnPinning) : updater
      onStateChange({ ...state, columnPinning: next })
    },
    onColumnSizingChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.columnSizing) : updater
      onStateChange({ ...state, columnSizing: next })
    },
    onColumnSizingInfoChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.columnSizingInfo) : updater
      onStateChange({ ...state, columnSizingInfo: next })
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === "function" ? updater(state.columnFilters) : updater
      onStateChange({ ...state, columnFilters: next })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
  })
}