'use client'

import { faceValue, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// The sheet's Podsumowanie split: „Robocizna" pre-rabat, „Rabat" taking it down to the executed
// value, „Materiały" as the single figure the investor is billed, then „Łącznie". Every row is a term
// of Łącznie, so the reader can add the columns down.
//
// Materiały spans both money tracks as ONE centred cell: it is a single amount that enters both axes
// unchanged, and printing it twice would read as a netto/brutto pair that happens to match.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  sumaPrac,
  sumaPracMismatch,
  rabat,
  rabatMismatch,
  materialsBilled,
  combined,
  scopeMarked = false,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  sumaPrac: MoneyPairT
  sumaPracMismatch?: string
  // Already negative, built by the caller (it owns the VAT rate). Undefined hides the row. Sits
  // directly under Robocizna because that is the figure it reduces.
  rabat?: MoneyPairT
  rabatMismatch?: string
  // What the investor is billed for materiały — one figure, on the plane they settle. 0 hides the row.
  materialsBilled: number
  // Robocizna po rabacie + materiały, on both axes.
  combined: MoneyPairT
  scopeMarked?: boolean
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      {/* Label stays bare „Robocizna" — it is the same pre-rabat figure the investment page's
          „z kosztorysu" block calls Robocizna, and the Rabat row right below removes any doubt. */}
      <SummaryRow
        label="Robocizna"
        line={sumaPrac}
        axis={moneyAxis}
        mismatch={sumaPracMismatch}
        scopeMarked={scopeMarked}
      />
      {rabat && (
        <SummaryRow
          label="Rabat"
          line={rabat}
          axis={moneyAxis}
          mismatch={rabatMismatch}
          discount
          scopeMarked={scopeMarked}
        />
      )}
      {materialsBilled !== 0 && (
        <SummaryRow label="Materiały" line={faceValue(materialsBilled)} axis={moneyAxis} span />
      )}
      <SummaryRow
        label="Łącznie"
        line={combined}
        axis={moneyAxis}
        emphasize
        scopeMarked={scopeMarked}
      />
    </SummaryTable>
  )
}
