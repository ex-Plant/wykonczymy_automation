'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils/cn'
import { DataTableRow } from './data-table-row'
import { VirtualizedTableBody } from './virtualized-table-body'
import { TableHeader } from './table-header'
import { TableFooter } from './table-footer'
import { EmptyRow } from './empty-row'
import { readOrder, readVisibility, writeOrder, writeVisibility } from './column-prefs-storage'
import { orderColumnKeys, type ColumnRanksT } from '@/lib/table/column-order'

// One object rather than a positional list: the toolbar needs the rank writers as well as the
// table, and every widening of that set would otherwise re-touch all eight call sites.
export type DataTableToolbarContextT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
  ranks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
}

// TanStack resolves a string accessorKey into the column id; a function accessor has no key and must
// carry an explicit id. Reading the defs (rather than the table) keeps the order out of the table's
// own construction, which would otherwise have to read a table that doesn't exist yet.
function leafColumnIds<TData>(columns: ColumnDef<TData, unknown>[]): string[] {
  return columns.map(
    (column) => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : ''),
  )
}

type DataTablePropsT<TData> = {
  data: TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  enableVirtualization?: boolean
  virtualRowHeight?: number
  virtualContainerHeight?: number
  /** localStorage key for persisting column visibility */
  storageKey?: string
  /** Sort applied on first render. Defaults to none. */
  initialSorting?: SortingState
  /** Makes the row clickable — navigates to the returned URL */
  getRowHref?: (row: TData) => string | undefined
  getRowClassName?: (row: TData) => string
  /** Summary `<tr>` pinned below the rows. Gets the visible column ids, in render order, so it can
   * span them or place a total under the column it belongs to even when some are hidden. */
  footer?: (visibleColumnIds: string[]) => React.ReactNode
  toolbar?: (ctx: DataTableToolbarContextT<TData>) => React.ReactNode
  className?: string
}

export function DataTable<TData>({
  data,
  columns,
  enableVirtualization = false,
  virtualRowHeight = 44,
  virtualContainerHeight = 600,
  storageKey,
  initialSorting = [],
  getRowHref,
  getRowClassName,
  footer,
  toolbar,
  className,
}: DataTablePropsT<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [ranks, setRanks] = useState<ColumnRanksT>({})

  // Apply persisted visibility and order after hydration to avoid server/client mismatch
  useEffect(() => {
    if (!storageKey) return
    setColumnVisibility(readVisibility(storageKey))
    setRanks(readOrder(storageKey))
  }, [storageKey])

  // Sparse: only a column the user actually dragged gets an entry, so an empty map is exactly the
  // declared order and a column added later ships at the position the code gives it.
  function persistRanks(next: ColumnRanksT) {
    setRanks(next)
    if (storageKey) writeOrder(storageKey, next)
  }

  function setRank(key: string, rank: number) {
    persistRanks({ ...ranks, [key]: rank })
  }

  function resetOrder() {
    persistRanks({})
  }

  const table = useReactTable({
    data: data as TData[],
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder: orderColumnKeys(leafColumnIds(columns), ranks),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (storageKey) writeVisibility(storageKey, next)
        return next
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtual scroll — only active when enableVirtualization is true
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => virtualRowHeight,
    overscan: 10,
    enabled: enableVirtualization,
  })

  const headerGroups = table.getHeaderGroups()
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const visibleColCount = visibleLeafColumns.length
  const visibleColumnIdList = visibleLeafColumns.map((column) => column.id)

  return (
    <div className={cn('space-y-2', className)}>
      {toolbar && (
        <div className="flex items-center gap-2">
          {toolbar({ table, columnVisibility, ranks, setRank, resetOrder })}
        </div>
      )}
      <div className="border-border overflow-x-auto rounded-lg border">
        {enableVirtualization ? (
          <VirtualizedTableBody
            parentRef={parentRef}
            containerHeight={virtualContainerHeight}
            headerGroups={headerGroups}
            rows={rows}
            virtualizer={virtualizer}
            visibleColumnIdList={visibleColumnIdList}
            getRowHref={getRowHref}
            getRowClassName={getRowClassName}
            footer={footer}
          />
        ) : (
          <table className="w-full text-sm">
            <TableHeader headerGroups={headerGroups} />
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={visibleColCount} />
              ) : (
                rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    row={row}
                    getRowHref={getRowHref}
                    getRowClassName={getRowClassName}
                  />
                ))
              )}
            </tbody>
            {footer && rows.length > 0 && <TableFooter>{footer(visibleColumnIdList)}</TableFooter>}
          </table>
        )}
      </div>
    </div>
  )
}
