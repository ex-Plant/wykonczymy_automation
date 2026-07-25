'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { useInvoiceZip } from '@/components/transfers/use-invoice-zip'
import { buildInvoiceArchiveName } from '@/lib/export/invoice-zip'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import type { MaterialTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  // Names the downloaded archive, so two investments pulled the same day don't collide in Downloads.
  investmentName: string
  // Both settled states — the toggle splits them.
  rows: MaterialTransactionRowT[]
  // Read-only public/preview render: no row links (they point into the app, which a client can't reach).
  clientView?: boolean
}

type DatasetT = 'unsettled' | 'settled'

// „Wydatki inwestycyjne" (unsettled — Σ === materialsGross) vs „Materiały wliczone w robociznę"
// (settled). Both sets show in every view, the client's included.
const DATASET_OPTIONS: OptionT<DatasetT>[] = [
  { value: 'unsettled', label: 'Wydatki inwestycyjne' },
  { value: 'settled', label: 'Materiały wliczone w robociznę' },
]

// Fixed height for the virtualizer's scroll container (px, not a flex track). Mirrors the wypłaty list.
const TABLE_HEIGHT = 400
const ROW_HEIGHT = 36

// The recorded `amount` is brutto, so the Kwota column is brutto and Σ (unsettled) === materialsGross.
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
    cell: ({ getValue }) => <span className="tabular-nums">{formatNet(getValue<number>())}</span>,
  },
]

// The wydatki inwestycyjne list — one row per materiały transaction, the un-summed twin of the
// „Wydatki inwestycyjne" breakdown above it. Same DataTable shell as the wypłaty list, with a toggle
// to the settled („wliczone w robociznę") set.
export function MaterialsTransactionsTable({
  investmentId,
  investmentName,
  rows,
  clientView = false,
}: PropsT) {
  const [dataset, setDataset] = useState<DatasetT>('unsettled')
  const { download, isPending } = useInvoiceZip()
  const visibleRows = rows.filter((row) => row.settled === (dataset === 'settled'))
  const hasSettled = rows.some((row) => row.settled)
  // Rows are already here, so an empty active dataset is knowable up front — no point offering a
  // button that could only ever answer „brak faktur". (The transfers variant can't know until it fetches.)
  const hasInvoices = visibleRows.some((row) => row.invoiceUrl)

  if (rows.length === 0) return null

  function handleDownload() {
    const label = DATASET_OPTIONS.find((option) => option.value === dataset)?.label ?? ''
    const date = new Date().toISOString().slice(0, 10)
    download(visibleRows, buildInvoiceArchiveName([investmentName, label], date))
  }

  return (
    <div className="mt-6 flex flex-col gap-y-2">
      <div className="flex items-center gap-2">
        {hasSettled && (
          <ToggleGroup
            options={DATASET_OPTIONS}
            value={dataset}
            onChange={setDataset}
            aria-label="Zestaw wydatków"
          />
        )}
        {hasInvoices && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isPending}
            aria-label="Pobierz faktury"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <FileArchive />}
            Faktury
          </Button>
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
