'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// The lower grid: Wpłaty deducted off Łącznie down to the bold „Do zapłaty". The informational
// „Udzielono rabatu" line lives in its own segment below (BruttoNettoSummary) so it can't read as a
// deduction step. Shares the money tracks with the breakdown above so both columns align.
export function SummaryTotalsTable({
  cols,
  moneyAxis,
  wplaty,
  doZaplaty,
  investmentId,
  clientView,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  wplaty: MoneyPairT
  doZaplaty: MoneyPairT
  investmentId: number
  clientView: boolean
}) {
  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryRow
        label={
          clientView ? (
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
