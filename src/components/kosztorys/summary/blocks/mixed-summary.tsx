import {
  computeMixedSettlement,
  faceValue,
  sumaPracPreRabat,
  type MaterialsT,
} from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'

type PropsT = {
  // Robocizna wartość netto — already post-rabat (Suma prac po rabacie).
  laborCostsNetFromKosztorys: number
  materials: MaterialsT
  vatRate: number
  deriveMaterialsNet: boolean
  materialsReduction: number
  // Wpłaty split by VAT plane: NET (+ unmarked) settle the netto section, GROSS the brutto section.
  paidNet: number
  paidGross: number
  // Rabat taken off the executed robocizna (net zł). Already inside `settlement.robocizna`, so the
  // Robocizna row adds it back and the Rabat row deducts it — Łącznie never moves.
  rabatAmount: number
}

// Tryb mieszany: one vertical netto→brutto tor (no netto/brutto columns). The netto section resolves
// Łącznie − wpłaty netto → „Do rozliczenia netto"; that remainder is grossed onto the invoice, where
// wpłaty brutto pay it down → „Do zapłaty brutto". Robocizna is shown przed rabatem with Rabat as its
// own row below Wpłaty, matching the Netto/Brutto block and the investment page's „z kosztorysu".
export function MixedSummary({
  laborCostsNetFromKosztorys,
  materials,
  vatRate,
  deriveMaterialsNet,
  materialsReduction,
  paidNet,
  paidGross,
  rabatAmount,
}: PropsT) {
  const settlement = computeMixedSettlement(
    laborCostsNetFromKosztorys,
    materials,
    vatRate,
    paidNet,
    paidGross,
    deriveMaterialsNet,
    materialsReduction,
  )
  const vatPercent = Math.round(vatRate * 100)
  const cols = summaryMoneyCols('net')

  return (
    <div className="flex w-fit flex-col gap-8 self-start">
      <SummaryTable cols={cols} className="w-fit">
        <SummaryHeaderCell variant="label">Rozliczenie netto</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>

        <SummaryRow
          label="Robocizna"
          line={faceValue(sumaPracPreRabat(settlement.robocizna, rabatAmount))}
          axis="net"
        />
        <SummaryRow label="Materiały" line={faceValue(settlement.materialy)} axis="net" />
        <SummaryRow label="Łącznie" line={faceValue(settlement.combinedNet)} axis="net" emphasize />
        {/* Negative: both are deduction steps down to „Do zapłaty netto". */}
        <SummaryRow
          label="Wpłaty netto"
          line={faceValue(-settlement.paidNet)}
          axis="net"
          discount
        />
        {rabatAmount > 0 && (
          <SummaryRow label="Rabat" line={faceValue(-rabatAmount)} axis="net" discount />
        )}
        <SummaryRow
          label="Do zapłaty netto"
          hint="Łącznie netto − wpłaty netto"
          line={faceValue(settlement.doRozliczeniaNet)}
          axis="net"
          bold
        />
      </SummaryTable>

      <SummaryTable cols={cols} className="w-fit">
        <SummaryHeaderCell variant="label">Rozliczenie fakturą</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>

        <SummaryRow
          label="Reszta brutto"
          hint={`Do rozliczenia netto + VAT ${vatPercent}%`}
          line={faceValue(settlement.resztaGross)}
          axis="net"
        />
        <SummaryRow
          label="Wpłaty brutto"
          line={faceValue(-settlement.paidGross)}
          axis="net"
          discount
        />
        <SummaryRow
          label="Do zapłaty brutto"
          hint="Reszta brutto − wpłaty brutto"
          line={faceValue(settlement.doZaplatyGross)}
          axis="net"
          bold
          danger={settlement.doZaplatyGross > 0}
        />
      </SummaryTable>
    </div>
  )
}
