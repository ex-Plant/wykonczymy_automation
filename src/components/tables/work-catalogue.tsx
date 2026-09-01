'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPercentPrecise } from '@/lib/kosztorys/format'
import { MAX_CLIENT_SHARE } from '@/lib/kosztorys/subcontractor-price-guard'
import { CatalogueRowActions } from '@/components/work-catalogue/catalogue-row-actions'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const col = createColumnHelper<WorkCatalogueItemT>()

// „auto" is the katalog declining to name a stawka — the kwota only exists once the praca lands in
// an inwestycja, so there is nothing to render as money here.
const money = (value: number | null) =>
  value === null ? (
    <span className="text-muted-foreground text-sm">auto</span>
  ) : (
    <span className="tabular-nums">{formatPLN(value)}</span>
  )

// The share of „Cena j.m." a stawka eats — its own column, sortable, because it is the figure the
// company's rule is written in. Over the ceiling it goes red and stops there: the katalog WARNS and
// never blocks, same stance as `appendCatalogueItems`. „Auto" has no share at all — the udział
// belongs to an inwestycja, not to the katalog.
const shareOf = (rate: number | null, clientPrice: number) =>
  rate !== null && clientPrice > 0 ? rate / clientPrice : null

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

// The break is written, not guessed from a width: these four labels are long enough to wrap on
// their own, and left to the browser they came out three lines deep.
const twoLines = (first: string, second: string) => () => (
  <span className="block">
    {first}
    <br />
    {second}
  </span>
)

const SHARE_TOOLTIP = `Udział stawki w cenie j.m. Powyżej ${MAX_CLIENT_SHARE * 100}% na czerwono.`

const descriptionColumn = col.accessor('description', {
  id: 'description',
  header: 'Opis pracy',
  meta: { minWidth: 'min-w-96' },
  cell: (info) => <span className="font-medium">{info.getValue()}</span>,
})

const categoryColumn = col.accessor((row) => row.category ?? '', {
  id: 'category',
  header: 'Kategoria',
  cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
})

const unitColumn = col.accessor('unit', {
  id: 'unit',
  header: 'j.m.',
  cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
})

const clientPriceColumn = col.accessor('clientPrice', {
  id: 'clientPrice',
  header: 'Cena j.m.',
  cell: (info) => money(info.getValue()),
})

const wToolsRateColumn = col.accessor('wToolsRate', {
  id: 'wToolsRate',
  header: twoLines('Stawka z', 'narzędziami'),
  meta: { label: 'Stawka z narzędziami' },
  cell: (info) => money(info.getValue()),
})

const wToolsShareColumn = col.accessor((row) => shareOf(row.wToolsRate, row.clientPrice), {
  id: 'wToolsShare',
  header: twoLines('% ceny klienta', 'z narzędziami'),
  meta: { tooltip: SHARE_TOOLTIP, label: '% ceny klienta z narzędziami' },
  cell: (info) => share(info.getValue()),
})

const ownToolsRateColumn = col.accessor('ownToolsRate', {
  id: 'ownToolsRate',
  header: twoLines('Stawka bez', 'narzędzi'),
  meta: { label: 'Stawka bez narzędzi' },
  cell: (info) => money(info.getValue()),
})

const ownToolsShareColumn = col.accessor((row) => shareOf(row.ownToolsRate, row.clientPrice), {
  id: 'ownToolsShare',
  header: twoLines('% ceny klienta', 'bez narzędzi'),
  meta: { tooltip: SHARE_TOOLTIP, label: '% ceny klienta bez narzędzi' },
  cell: (info) => share(info.getValue()),
})

// „Dodaj pracę z katalogu" reads the cennik to pick from it, never to tune it — so the udział
// columns (the instrument for setting a stawka) and „Akcje" stay behind on /katalog-prac. They sit
// in the middle of the order, which is why the two lists are assembled rather than sliced.
export const WORK_CATALOGUE_PICKER_COLUMNS = [
  descriptionColumn,
  categoryColumn,
  unitColumn,
  clientPriceColumn,
  wToolsRateColumn,
  ownToolsRateColumn,
]

export function getWorkCatalogueColumns({
  categorySuggestions,
}: {
  categorySuggestions: readonly string[]
}) {
  return [
    descriptionColumn,
    categoryColumn,
    unitColumn,
    clientPriceColumn,
    wToolsRateColumn,
    wToolsShareColumn,
    ownToolsRateColumn,
    ownToolsShareColumn,

    col.display({
      id: 'actions',
      header: 'Akcje',
      cell: (info) => (
        <CatalogueRowActions item={info.row.original} categorySuggestions={categorySuggestions} />
      ),
    }),
  ]
}
