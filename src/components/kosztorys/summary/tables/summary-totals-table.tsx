'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// Łącznie (from the breakdown grid above) minus Wpłaty = „Do zapłaty" — the only deduction step at
// this level, Rabat having already been taken off the Robocizna it reduces. Shares the money tracks
// with that grid so both tables' columns align.
export function SummaryTotalsTable({
  cols,
  moneyAxis,
  wplaty,
  doZaplaty,
  investmentId,
  preview,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  wplaty: MoneyPairT
  doZaplaty: MoneyPairT
  investmentId: number
  preview: boolean
}) {
  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryRow
        label={
          preview ? (
            'Wpłaty'
          ) : (
            <Link
              href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })}
              className="hover:underline"
            >
              Wpłaty
            </Link>
          )
        }
        line={wplaty}
        axis={moneyAxis}
        discount
        noBrutto
      />
      <SummaryRow
        label="Do zapłaty"
        line={doZaplaty}
        axis={moneyAxis}
        bold
        danger={doZaplaty.net > 0}
      />
    </SummaryTable>
  )
}
