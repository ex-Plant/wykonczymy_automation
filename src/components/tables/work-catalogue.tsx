'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/utils/format-currency'
import { CatalogueRowActions } from '@/components/work-catalogue/catalogue-row-actions'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

const money = (value: number) => <span className="tabular-nums">{formatPLN(value)}</span>

export function getWorkCatalogueColumns({
  categorySuggestions,
}: {
  categorySuggestions: readonly string[]
}) {
  return [
    col.accessor('description', {
      id: 'description',
      header: 'Opis pracy',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),

    col.accessor((row) => row.category ?? '', {
      id: 'category',
      header: 'Kategoria',
      cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
    }),

    col.accessor('unit', {
      id: 'unit',
      header: 'j.m.',
      cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
    }),

    col.accessor('clientPrice', {
      id: 'clientPrice',
      header: 'Cena j.m.',
      meta: { align: 'right' },
      cell: (info) => money(info.getValue()),
    }),

    col.accessor('wToolsRate', {
      id: 'wToolsRate',
      header: 'Stawka z narzędziami',
      meta: { align: 'right' },
      cell: (info) => money(info.getValue()),
    }),

    col.accessor('ownToolsRate', {
      id: 'ownToolsRate',
      header: 'Stawka bez narzędzi',
      meta: { align: 'right' },
      cell: (info) => money(info.getValue()),
    }),

    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <CatalogueRowActions item={info.row.original} categorySuggestions={categorySuggestions} />
      ),
    }),
  ]
}
