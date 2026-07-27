'use client'

import { faceValue } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { calculateMargin } from '@/lib/db/calculate-margin'

const HINTS = {
  laborCosts: 'Kwota, którą inwestor płaci firmie za pracę. Podstawa marży.',
  payouts: 'Kwoty wypłacone pracownikom.',
  rabat: 'Rabat na robociznę — firma rezygnuje z części ceny.',
  settled: 'Materiały kupione przez firmę, wliczone w cenę robocizny. Nie obciążają inwestora.',
  materialsDiscount:
    'Wydatki rozliczane po kwocie netto zamiast po kwocie z paragonu — inwestor zwraca mniej, ' +
    'niż firma wydała.',
  loss: 'Koszt pokrywany przez firmę.',
  margin: 'Ile firma zarabia na inwestycji.\nWidoczność — właściciel.',
} as const

type PropsT = {
  financials: InvestmentFinancialsT
}

// Company-plane figures — rendered as its own tab in the summary panel (owner-only, dropped from
// every client share by the panel's view gate). The role check here is a second, redundant gate:
// nothing in this component is the investor's business, so it fails closed even if the host's gate
// were ever wrong.
//
// A waterfall, not a lone marża figure with badges beside it: every subtrahend is shown as its own
// row, so the reader adds the column down and lands on the total. That is the difference between a
// number you can check and a number you have to trust — a marża of −1 mln driven by a settled-material
// row is unreadable until that row is on screen next to it.
export function InvestmentOwnerFigures({ financials }: PropsT) {
  const { role: userRole } = useCurrentUser()
  if (!isAdminOrOwnerRole(userRole)) return null

  const {
    totalLaborCosts,
    totalPayouts,
    totalRabat,
    totalLoss,
    totalSettled,
    materialsNetDiscount,
  } = financials
  const margin = calculateMargin(financials)

  // No VAT plane here: marża is a company-internal figure summed from net transfer amounts, so every
  // row is a face value on a single „Kwota" track.
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
      {/* Each deduction renders negative: a positive figure in a subtracted row reads as if it were
          being added, which is exactly the confusion this block exists to remove. Rows at 0 are
          dropped — a zero deduction is noise, not information. */}
      {totalPayouts !== 0 && (
        <SummaryRow
          label="Wypłaty"
          hint={HINTS.payouts}
          line={faceValue(-totalPayouts)}
          axis="net"
          discount
        />
      )}
      {totalRabat !== 0 && (
        <SummaryRow
          label="Rabat"
          hint={HINTS.rabat}
          line={faceValue(-totalRabat)}
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
