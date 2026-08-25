'use client'

import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// The sheet's Podsumowanie split: „Robocizna" pre-rabat, „Rabat" taking it down to the executed
// value, „Materiały", then „Łącznie". Every row is a term of Łącznie, so the reader can add the
// columns down.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  laborCostsPair,
  laborCostsMismatch,
  discount,
  discountMismatch,
  materialsPair,
  combined,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  laborCostsPair: MoneyPairT
  laborCostsMismatch?: string
  // Already negative, built by the caller (it owns the VAT rate). Undefined hides the row. Sits
  // directly under Robocizna because that is the figure it reduces.
  discount?: MoneyPairT
  discountMismatch?: string
  // What the investor is billed for materiały, on both planes. 0 on both hides the row.
  materialsPair: MoneyPairT
  // Robocizna po rabacie + materiały, on both axes.
  combined: MoneyPairT
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      {/* Label stays bare „Robocizna" — it is the same pre-rabat figure the investment page's
          „z kosztorysu" block calls Robocizna, and the Rabat row right below removes any doubt. */}
      <SummaryRow
        label="Robocizna"
        line={laborCostsPair}
        axis={moneyAxis}
        mismatch={laborCostsMismatch}
      />
      {discount && (
        <SummaryRow
          label="Rabat"
          line={discount}
          axis={moneyAxis}
          mismatch={discountMismatch}
          discount
        />
      )}
      {materialsPair.gross !== 0 && (
        <SummaryRow label="Materiały" line={materialsPair} axis={moneyAxis} />
      )}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize />
    </SummaryTable>
  )
}
