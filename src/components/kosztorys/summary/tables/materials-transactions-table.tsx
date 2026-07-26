'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { formatNet } from '@/lib/kosztorys/format'
import {
  availableWydatkiDatasets,
  partitionWydatkiRows,
  sumBilled,
  wydatkiRowHref,
  type WydatkiDatasetT,
} from '@/lib/kosztorys/wydatki-datasets'
import { formatPLDate } from '@/lib/utils/format-date'
import type { MaterialTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  // Every expense type and both settled states — the tabs split them.
  rows: MaterialTransactionRowT[]
  // Read-only public/preview render: no row links (they point into the app, which a client can't reach).
  clientView?: boolean
}

const DATASET_LABELS: Record<WydatkiDatasetT, string> = {
  gross: 'Materiały',
  net: 'Materiały rozliczane netto',
  settled: 'Materiały wliczone w robociznę',
}

const TABLE_HEIGHT = 400
const ROW_HEIGHT = 36
// The scroll container wraps thead + tbody + tfoot together, so a height computed from body rows
// alone clips the header and the „Razem" footer — budget their rendered height too.
const HEADER_HEIGHT = 41
const FOOTER_HEIGHT = 41

const SHARED_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
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
]

// Netto comes last of the two so the „Razem" cell — which sums `billed` — sits under the column it
// actually totals.
const NET_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
  ...SHARED_COLUMNS,
  {
    accessorKey: 'amount',
    header: 'Brutto',
    meta: { align: 'right' },
    cell: ({ getValue }) => <span className="tabular-nums">{formatNet(getValue<number>())}</span>,
  },
  {
    accessorKey: 'billed',
    header: 'Netto',
    meta: { align: 'right' },
    cell: ({ getValue }) => <span className="tabular-nums">{formatNet(getValue<number>())}</span>,
  },
]

// The brutto sets bill at `amount`, so one column says everything.
const GROSS_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
  ...SHARED_COLUMNS,
  {
    accessorKey: 'amount',
    header: 'Kwota',
    meta: { align: 'right' },
    cell: ({ getValue }) => <span className="tabular-nums">{formatNet(getValue<number>())}</span>,
  },
]

// The wydatki list — one row per materiały transaction, the un-summed twin of the „Wydatki
// inwestycyjne" breakdown above it.
export function MaterialsTransactionsTable({ investmentId, rows, clientView = false }: PropsT) {
  const partition = partitionWydatkiRows(rows)
  const available = availableWydatkiDatasets(partition)
  const [dataset, setDataset] = useState<WydatkiDatasetT>('gross')
  // A prop change can empty the picked set (an expense re-categorised away); fall back rather than
  // render a tab with nothing in it.
  const activeDataset = available.includes(dataset) ? dataset : (available[0] ?? 'gross')
  const visibleRows = partition[activeDataset]

  const options: OptionT<WydatkiDatasetT>[] = available.map((set) => ({
    value: set,
    label: DATASET_LABELS[set],
  }))

  if (rows.length === 0) return null

  return (
    <div className="mt-6 flex flex-col gap-y-2">
      <div>
        {options.length > 1 && (
          <ToggleGroup
            options={options}
            value={activeDataset}
            onChange={setDataset}
            aria-label="Zestaw wydatków"
          />
        )}
      </div>
      <DataTable
        key={activeDataset}
        data={visibleRows}
        columns={activeDataset === 'net' ? NET_COLUMNS : GROSS_COLUMNS}
        enableVirtualization
        virtualRowHeight={ROW_HEIGHT}
        virtualContainerHeight={Math.min(
          visibleRows.length * ROW_HEIGHT + HEADER_HEIGHT + FOOTER_HEIGHT,
          TABLE_HEIGHT,
        )}
        initialSorting={[{ id: 'date', desc: true }]}
        getRowHref={clientView ? undefined : (row) => wydatkiRowHref(investmentId, row)}
        footer={(colCount) => (
          <tr>
            <td className="font-bold" colSpan={colCount - 1}>
              Razem
            </td>
            <td className="text-right font-bold tabular-nums">
              {formatNet(sumBilled(visibleRows))}
            </td>
          </tr>
        )}
        className="w-full max-w-5xl"
      />
    </div>
  )
}
