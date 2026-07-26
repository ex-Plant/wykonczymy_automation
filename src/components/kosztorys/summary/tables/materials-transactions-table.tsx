'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import type { MaterialTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  // Both settled states — the toggle splits them.
  rows: MaterialTransactionRowT[]
  // Read-only public/preview render: no row links (they point into the app, which a client can't reach).
  clientView?: boolean
}

type DatasetT = 'unsettled' | 'settled'

// „Wydatki inwestycyjne" (unsettled — Σ billed === totalMaterialCosts) vs „Materiały wliczone w robociznę"
// (settled). Both sets show in every view, the client's included.
const DATASET_OPTIONS: OptionT<DatasetT>[] = [
  { value: 'unsettled', label: 'Wydatki inwestycyjne' },
  { value: 'settled', label: 'Materiały wliczone w robociznę' },
]

// Fixed height for the virtualizer's scroll container (px, not a flex track). Mirrors the wypłaty list.
const TABLE_HEIGHT = 400
const ROW_HEIGHT = 36

// Brutto is what left the kasa; a netto-billed row adds the billed figure beneath it, because that
// is the number the breakdown above this list sums — without it the two disagree by the VAT reclaim.
const MATERIAL_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
  {
    accessorKey: 'date',
    header: 'Data',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatPLDate(getValue<string>())}</span>
    ),
  },
  { accessorKey: 'label', header: 'Kategoria' },
  {
    accessorKey: 'description',
    header: 'Opis',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() || '—'}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Kwota brutto',
    meta: { align: 'right' },
    cell: ({ row, getValue }) => (
      <span className="flex flex-col tabular-nums">
        {formatNet(getValue<number>())}
        {row.original.billed !== row.original.amount && (
          <span className="text-muted-foreground text-xs">
            netto {formatNet(row.original.billed)}
          </span>
        )}
      </span>
    ),
  },
]

// The wydatki inwestycyjne list — one row per materiały transaction, the un-summed twin of the
// „Wydatki inwestycyjne" breakdown above it. Same DataTable shell as the wypłaty list, with a toggle
// to the settled („wliczone w robociznę") set.
export function MaterialsTransactionsTable({ investmentId, rows, clientView = false }: PropsT) {
  const [dataset, setDataset] = useState<DatasetT>('unsettled')
  const visibleRows = rows.filter((row) => row.settled === (dataset === 'settled'))
  const hasSettled = rows.some((row) => row.settled)

  if (rows.length === 0) return null

  return (
    <div className="mt-6 flex flex-col gap-y-2">
      <div>
        {hasSettled && (
          <ToggleGroup
            options={DATASET_OPTIONS}
            value={dataset}
            onChange={setDataset}
            aria-label="Zestaw wydatków"
          />
        )}
      </div>
      <DataTable
        key={dataset}
        data={visibleRows}
        columns={MATERIAL_COLUMNS}
        enableVirtualization
        virtualRowHeight={ROW_HEIGHT}
        virtualContainerHeight={TABLE_HEIGHT}
        initialSorting={[{ id: 'date', desc: true }]}
        getRowHref={
          clientView
            ? undefined
            : (row) => `/inwestycje/${investmentId}?type=INVESTMENT_EXPENSE&id=${row.id}`
        }
        className="w-full max-w-5xl"
      />
    </div>
  )
}
