'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// One step of the settlement. A step is normally single-plane — the plane is in the label, not in a
// column — because a wpłata exists on the plane it was made on and nowhere else, so a second column
// would have to invent a figure. `line` is a pair regardless, so the one row that genuinely spans
// both planes („Do zapłaty") can share this table instead of needing a second component.
export type SettlementRowT = {
  label: string
  line: MoneyPairT
  // Formula/qualifier under the figure, for the steps a reader can't reconstruct from the row above.
  hint?: string
  discount?: boolean
  bold?: boolean
  danger?: boolean | { net: boolean; gross: boolean }
  // Renders as ONE centred cell across both money tracks — for a step that carries no VAT and so
  // comes off both planes at the same złoty. Printing it twice reads as a netto/brutto pair that
  // happens to match. No effect on a single-plane table.
  span?: boolean
  // Links the label to the investment's filtered wpłaty list — the deposit rows only.
  linkToDeposits?: boolean
  scopeMarked?: boolean
}

export function SummaryTotalsTable({
  cols,
  caption,
  axis,
  rows,
  investmentId,
  preview,
}: {
  cols: string
  // Names the tor. Omitted where the settlement has only one, and a header would label nothing.
  caption?: string
  axis: MoneyAxisT
  rows: SettlementRowT[]
  investmentId: number
  preview: boolean
}) {
  const { net, gross } = axisShows(axis)
  const bothPlanes = net && gross
  // A two-column table always needs its Netto/Brutto headers, caption or not — two bare figures side
  // by side name neither plane. A single-plane tor only heads itself when it has a tor name to print.
  return (
    <SummaryTable cols={cols} className="w-fit">
      {(bothPlanes || caption !== undefined) && (
        <>
          <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
          {bothPlanes ? (
            <SummaryMoneyHeaders axis={axis} />
          ) : (
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>
          )}
        </>
      )}
      {rows.map((row) => (
        <SummaryRow
          key={row.label}
          label={
            row.linkToDeposits && !preview ? (
              <Link
                href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })}
                className="hover:underline"
              >
                {row.label}
              </Link>
            ) : (
              row.label
            )
          }
          line={row.line}
          axis={axis}
          hint={row.hint}
          discount={row.discount}
          bold={row.bold}
          danger={row.danger}
          span={row.span}
          scopeMarked={row.scopeMarked}
        />
      ))}
    </SummaryTable>
  )
}
