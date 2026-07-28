'use client'

import {
  computeSummarySplit,
  faceValue,
  moneyPair,
  type MaterialsT,
  summaryLine,
  sumaPracPreRabat,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { formatNet } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { SummaryBreakdownTable } from '@/components/kosztorys/summary/tables/summary-breakdown-table'
import { SummaryTotalsTable } from '@/components/kosztorys/summary/tables/summary-totals-table'
import {
  reconciliationTooltip,
  type KosztorysReconciliationT,
  type ReconT,
} from '@/lib/kosztorys/reconciliation'

// The scream's tooltip names both compared figures + the różnica; formatNet because this surface shows
// kosztorys nets. Shared copy with the investment page (reconciliationTooltip).
const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (po rabacie) — client-side, reacts to unsaved edits.
  laborCostsNetFromKosztorys: number
  // The „Do zapłaty" pair (robocizna + materiały − wpłaty), computed by the panel so its collapsed
  // headline and this table's bottom row can't drift apart.
  doZaplaty: MoneyPairT
  // Materiały in two buckets — the brutto base (netto derived by removing VAT) and the netto-billed
  // part, which is already netto and stays at face value on both axes.
  materials: MaterialsT
  // Wpłaty netto — Σ of the investment's INVESTOR_DEPOSIT rows; subtracted from Łącznie to reach
  // „Do zapłaty". Same base the deposit list / Wpłaty tab / plane pie draw.
  wplatyNet: number
  // The rabat actually taken off the executed robocizna (net zł): the global discount when active,
  // else Σ per-item rabat. Unified upstream so this table shows one explicit „Rabat" line. 0 = none.
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — the mismatch scream renders off this. Always supplied
  // (the body computes it unconditionally); preview suppresses the scream via reconVisible, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  // Active price view. The verdict compares client-view nets, so the scream only reads correctly in
  // 'client'; a subcontractor view reprices the displayed figure, so the scream is suppressed there.
  priceView: PriceViewT
  vatRate: number
  moneyAxis: MoneyAxisT
  // The investment's saved materiały netto rate (null = off) — drives both the Materiały row and the
  // „Obniżka materiałów" line that makes the concession visible.
  materialsNetRate: number | null
  // Read-only client render: the mismatch scream is an owner-internal signal (a client's view is
  // always 'client', which is exactly when the scream would fire), and the internal drill-down links
  // point at owner-only pages — so gate the scream off and render those labels as plain text.
  preview?: boolean
  // The host's transaction figures are narrowed by URL filters the kosztorys can't follow (EX-600).
  // Stars the kosztorys-plane rows AND withholds the mismatch scream: that verdict compares the whole
  // kosztorys against a filtered ledger, so under a filter it reports the filter as a gap.
  filtersActive?: boolean
}

// The single bottom summary block: the robocizna waterfall (Suma prac wykonanych → Rabat →
// Robocizna) merged with the sheet Podsumowanie split (Robocizna / Materiały / Łącznie), then
// Wpłaty subtracted to reach „Do zapłaty" — one grid, no separate totals bar.
export function BruttoNettoSummary({
  investmentId,
  laborCostsNetFromKosztorys,
  doZaplaty,
  materials,
  wplatyNet,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  moneyAxis,
  materialsNetRate,
  preview = false,
  filtersActive = false,
}: PropsT) {
  // Łącznie = Robocizna (przed rabatem) − Rabat + Materiały, and Łącznie − Wpłaty = „Do zapłaty".
  // The split feeds off the POST-rabat robocizna, so Łącznie already nets the rabat out — which is
  // exactly why the Rabat row belongs above it, between the pre-rabat Robocizna and Łącznie, where
  // the column the reader adds actually reconciles.
  const { combined } = computeSummarySplit(
    laborCostsNetFromKosztorys,
    materials,
    vatRate,
    materialsNetRate,
  )
  // The scream compares client-view nets; a subcontractor view reprices the displayed figure, so the
  // scream would sit next to a number it isn't comparing. Show it only in the client view.
  const reconVisible = !preview && !filtersActive && priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  // Only while the scream is visible; otherwise the row follows the normal „rabat > 0" rule.
  const showRabat =
    rabatAmount > 0 ||
    (reconVisible && (reconciliation.rabat.actual > 0 || reconciliation.rabat.mismatch))
  const sumaPrac = summaryLine(
    sumaPracPreRabat(laborCostsNetFromKosztorys, rabatAmount),
    combined.net,
    vatRate,
  )
  // Rabat lives on the prace plane and grosses — brutto = rabat×(1+VAT) — so both axes read a real
  // figure. Both it and Wpłaty render negative: they are the two deduction steps down to „Do zapłaty"
  // (rabat off Robocizna, wpłaty off Łącznie), and a positive figure in a subtracted row reads as if
  // it were being added.
  const rabat = moneyPair(-rabatAmount, vatRate)
  const wplaty = faceValue(-wplatyNet)

  const moneyCols = summaryMoneyCols(moneyAxis)

  return (
    <div className="text-foreground flex flex-col items-start gap-x-12 gap-y-8 text-sm">
      <div className="flex w-fit flex-col gap-8">
        <SummaryBreakdownTable
          cols={moneyCols}
          moneyAxis={moneyAxis}
          sumaPrac={sumaPrac}
          sumaPracMismatch={
            reconVisible && reconciliation.laborCosts.mismatch
              ? mismatchTooltip(reconciliation.laborCosts, 'Transakcje robocizny')
              : undefined
          }
          rabat={showRabat ? rabat : undefined}
          rabatMismatch={
            reconVisible && reconciliation.rabat.mismatch
              ? mismatchTooltip(reconciliation.rabat, 'Transakcje rabatu')
              : undefined
          }
          materials={materials}
          combinedNet={combined.net}
          combined={combined}
          materialsNetRate={materialsNetRate}
          scopeMarked={filtersActive}
        />
        <SummaryTotalsTable
          cols={moneyCols}
          moneyAxis={moneyAxis}
          wplaty={wplaty}
          doZaplaty={doZaplaty}
          investmentId={investmentId}
          preview={preview}
          scopeMarked={filtersActive}
        />
      </div>
    </div>
  )
}
