'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPercentPrecise } from '@/lib/kosztorys/format'
import { MAX_CLIENT_SHARE } from '@/lib/kosztorys/subcontractor-price-guard'
import { CatalogueRowActions } from '@/components/work-catalogue/catalogue-row-actions'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

const money = (value: number) => <span className="tabular-nums">{formatPLN(value)}</span>

// The share of „Cena j.m." a stawka eats — its own column, sortable, because it is the figure the
// company's rule is written in. Over the ceiling it goes red and stops there: the katalog WARNS and
// never blocks, same stance as `appendCatalogueItems`.
const shareOf = (rate: number, clientPrice: number) => (clientPrice > 0 ? rate / clientPrice : null)

const share = (value: number | null) =>
  value === null ? (
    <span className="text-muted-foreground text-sm">—</span>
  ) : (
    <span
      className={cn('tabular-nums', value > MAX_CLIENT_SHARE && 'text-destructive font-medium')}
    >
      {formatPercentPrecise(value)}
    </span>
  )

const SHARE_TOOLTIP = `Udział stawki w cenie j.m. Powyżej ${MAX_CLIENT_SHARE * 100}% na czerwono.`

export function getWorkCatalogueColumns({
  categorySuggestions,
}: {
  categorySuggestions: readonly string[]
}) {
  return [
    col.accessor('description', {
      id: 'description',
      header: 'Opis pracy',
      meta: { minWidth: 'min-w-96' },
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
      meta: { align: 'right', headerWrap: true },
      cell: (info) => money(info.getValue()),
    }),

    col.accessor((row) => shareOf(row.wToolsRate, row.clientPrice), {
      id: 'wToolsShare',
      header: '% ceny klienta z narzędziami',
      meta: { align: 'right', tooltip: SHARE_TOOLTIP, headerWrap: true },
      cell: (info) => share(info.getValue()),
    }),

    col.accessor('ownToolsRate', {
      id: 'ownToolsRate',
      header: 'Stawka bez narzędzi',
      meta: { align: 'right', headerWrap: true },
      cell: (info) => money(info.getValue()),
    }),

    col.accessor((row) => shareOf(row.ownToolsRate, row.clientPrice), {
      id: 'ownToolsShare',
      header: '% ceny klienta bez narzędzi',
      meta: { align: 'right', tooltip: SHARE_TOOLTIP, headerWrap: true },
      cell: (info) => share(info.getValue()),
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
