'use client'

import { useState, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

type DataTablePropsT<TData> = {
  readonly data: readonly TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly columns: ColumnDef<TData, any>[]
  readonly emptyMessage?: string
  readonly enableVirtualization?: boolean
  readonly virtualRowHeight?: number
  readonly virtualContainerHeight?: number
}

export function DataTable<TData>({
  data,
  columns,
  emptyMessage = 'Brak danych',
  enableVirtualization = false,
  virtualRowHeight = 44,
  virtualContainerHeight = 600,
}: DataTablePropsT<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: data as TData[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtual scroll setup
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => virtualRowHeight,
    overscan: 10,
    enabled: enableVirtualization,
  })

  const headerGroups = table.getHeaderGroups()

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      {enableVirtualization ? (
        <div ref={parentRef} style={{ height: virtualContainerHeight, overflow: 'auto' }}>
          <table className="w-full text-sm">
            <TableHeader headerGroups={headerGroups} />
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={columns.length} message={emptyMessage} />
              ) : (
                <>
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0 }}
                        colSpan={columns.length}
                      />
                    </tr>
                  )}
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index]!
                    return (
                      <tr
                        key={row.id}
                        className="border-border border-b last:border-b-0"
                        style={{ height: virtualRowHeight }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="text-foreground px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        style={{
                          height:
                            virtualizer.getTotalSize() -
                            (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        }}
                        colSpan={columns.length}
                      />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <table className="w-full text-sm">
          <TableHeader headerGroups={headerGroups} />
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={columns.length} message={emptyMessage} />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-border border-b last:border-b-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="text-foreground px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TableHeader({ headerGroups }: { headerGroups: any[] }) {
  return (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id} className="border-border bg-muted/50 border-b">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {headerGroup.headers.map((header: any) => {
            const canSort = header.column.getCanSort()
            const sorted = header.column.getIsSorted()

            return (
              <th
                key={header.id}
                className={cn(
                  'text-muted-foreground px-4 py-3 text-left text-sm font-medium',
                  canSort && 'cursor-pointer select-none',
                )}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && (
                    <SortIcon sorted={sorted} />
                  )}
                </span>
              </th>
            )
          })}
        </tr>
      ))}
    </thead>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="size-3.5" />
  if (sorted === 'desc') return <ArrowDown className="size-3.5" />
  return <ArrowUpDown className="size-3.5 opacity-40" />
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted-foreground px-4 py-8 text-center">
        {message}
      </td>
    </tr>
  )
}
