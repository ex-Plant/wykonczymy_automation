'use client'

import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// The lower grid: Wpłaty then Rabat off Łącznie, down to the bold „Do zapłaty". Shares the money
// tracks with the breakdown above so both columns align.
export function SummaryTotalsTable({
  cols,
  moneyAxis,
  wplaty,
  rabat,
  rabatMismatch,
  materialsDiscount,
  doZaplaty,
  investmentId,
  clientView,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  wplaty: MoneyPairT
  // The rabat pair, already built by the caller (it owns the VAT rate). Undefined hides the row
  // entirely — there is no rabat worth showing. Informational: Łącznie above is already post-rabat,
  // so this row makes the concession visible without moving the total.
  rabat?: MoneyPairT
  rabatMismatch?: string
  // „Obniżka materiałów" — what billing materiały netto gives away, already negative. Undefined at
  // zero (no rate saved, or a brutto-settled investment). Informational like Rabat: Łącznie is
  // already net of it, but a figure that silently lowers marża has to be readable somewhere.
  materialsDiscount?: MoneyPairT
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
      {rabat && (
        <SummaryRow label="Rabat" line={rabat} axis={moneyAxis} mismatch={rabatMismatch} discount />
      )}
      {materialsDiscount && (
        <SummaryRow
          label="Obniżka materiałów"
          hint="Wydatki rozliczane po kwocie netto zamiast po kwocie z paragonu"
          line={materialsDiscount}
          axis={moneyAxis}
          discount
          noBrutto
        />
      )}
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
