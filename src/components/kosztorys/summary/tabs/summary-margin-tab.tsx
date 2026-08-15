'use client'

import { faceValue } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { financialsOnReading } from '@/lib/kosztorys/summary-reading'
import type { SummaryReadingT } from '@/lib/kosztorys/summary-reading'
import { calculateMargin } from '@/lib/db/calculate-margin'

const HINTS = {
  laborCosts: 'Kwota, którą inwestor płaci firmie za pracę. Podstawa marży.',
  payouts: 'Kwoty wypłacone pracownikom.',
  discount: 'Rabat na robociznę — firma rezygnuje z części ceny.',
  settled: 'Materiały kupione przez firmę, wliczone w cenę robocizny. Nie obciążają inwestora.',
  materialsDiscount:
    'Wydatki rozliczane po kwocie netto zamiast po kwocie z paragonu — inwestor zwraca mniej, ' +
    'niż firma wydała.',
  loss: 'Koszt pokrywany przez firmę — obniża jej marżę i dług inwestora.',
  margin: 'Ile firma zarabia na inwestycji.\nWidoczność — właściciel.',
} as const

type PropsT = {
  financials: InvestmentFinancialsT
} & SummaryReadingT

// Company-plane figures. Visibility is enforced upstream by the host omitting `financials` for anyone
// but ADMIN/OWNER, which keeps the numbers out of the RSC payload rather than merely off the screen —
// so this component carries no role check of its own.
//
// Robocizna and rabat arrive as the reading the host resolved, not off `financials`: the block above
// this tab is already on that plane, and a tab reading the transactions figures made the same panel
// report two different robocizny. Everything else below stays `financials`-sourced — wypłaty, strata
// and materiały are cash movements the kosztorys knows nothing about.
export function SummaryMarginTab({ financials, laborCostsNet, rabatAmount }: PropsT) {
  const reading = { laborCostsNet, rabatAmount }
  const readFinancials = financialsOnReading(financials, reading)
  const {
    totalLaborCosts,
    totalPayouts,
    totalDiscount,
    totalLoss,
    totalSettled,
    materialsNetDiscount,
  } = readFinancials
  const margin = calculateMargin(readFinancials)

  // No VAT plane: marża sums net transfer amounts, so there is one „Kwota" track.
  const cols = summaryMoneyCols('net')

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">Marża</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      <SummaryRow
        label="Robocizna"
        hint={HINTS.laborCosts}
        line={faceValue(totalLaborCosts)}
        axis="net"
      />
      {totalPayouts !== 0 && (
        <SummaryRow
          label="Wypłaty"
          hint={HINTS.payouts}
          line={faceValue(-totalPayouts)}
          axis="net"
          discount
        />
      )}
      {totalDiscount !== 0 && (
        <SummaryRow
          label="Rabat"
          hint={HINTS.discount}
          line={faceValue(-totalDiscount)}
          axis="net"
          discount
        />
      )}
      {totalSettled !== 0 && (
        <SummaryRow
          label="Materiały wliczone w robociznę"
          hint={HINTS.settled}
          line={faceValue(-totalSettled)}
          axis="net"
          discount
        />
      )}
      {materialsNetDiscount !== 0 && (
        <SummaryRow
          label="Obniżka materiałów"
          hint={HINTS.materialsDiscount}
          line={faceValue(-materialsNetDiscount)}
          axis="net"
          discount
        />
      )}
      {totalLoss !== 0 && (
        <SummaryRow
          label="Strata"
          hint={HINTS.loss}
          line={faceValue(-totalLoss)}
          axis="net"
          discount
        />
      )}
      <SummaryRow
        label="Marża"
        hint={HINTS.margin}
        line={faceValue(margin)}
        axis="net"
        bold
        danger={margin < 0}
      />
    </SummaryTable>
  )
}
