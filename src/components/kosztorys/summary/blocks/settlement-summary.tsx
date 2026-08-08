'use client'

import { combinedPair, moneyPair, sumaPracPreRabat } from '@/lib/kosztorys/summary-economics'
import { formatNet } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { SUMMARY_LABEL_COL, SUMMARY_VALUE_COL } from '@/components/ui/summary-grid'
import { SummaryBreakdownTable } from '@/components/kosztorys/summary/tables/summary-breakdown-table'
import { SummaryTotalsTable } from '@/components/kosztorys/summary/tables/summary-totals-table'
import type { SettlementGroupT } from '@/components/kosztorys/summary/settlement-groups'
import {
  reconciliationTooltip,
  type KosztorysReconciliationT,
  type ReconT,
} from '@/lib/kosztorys/reconciliation'

// The scream's tooltip names both compared figures + the różnica; formatNet because this surface shows
// kosztorys nets. Shared copy with the investment page (reconciliationTooltip).
const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

// Both money columns stand in every tryb rozliczenia, client-facing preview included (owner,
// 2026-08-07). The tryb decides the arithmetic behind „Do zapłaty" — never which columns exist — so a
// reader can always quote both kwoty without switching a control first.
const MONEY_AXIS: MoneyAxisT = 'both'

// The settlement table carries one money track where the breakdown above carries two — span both so
// the two tables end on the same edge instead of the lower one stepping in by a column.
const SETTLEMENT_COLS = `${SUMMARY_LABEL_COL} calc(${SUMMARY_VALUE_COL} * 2 + 1px)`

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (po rabacie) — client-side, reacts to unsaved edits.
  laborCostsNetFromKosztorys: number
  // What the investor is billed for materiały — one figure on the plane they settle, built upstream
  // by `billedMaterials`. It enters both money columns unchanged, so the table renders it as a single
  // merged cell rather than a netto/brutto pair.
  materialsBilled: number
  // The settlement steps below the breakdown, built by the caller because their sequence IS the tryb
  // rozliczenia — mieszany resolves through a reszta the other tryby don't have, and splits into two
  // tory (gotówka / faktura) that each settle their own debt.
  settlementGroups: SettlementGroupT[]
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
  // Read-only client render: the mismatch scream is an owner-internal signal (a client's view is
  // always 'client', which is exactly when the scream would fire), and the internal drill-down links
  // point at owner-only pages — so gate the scream off and render those labels as plain text.
  preview?: boolean
}

// The bottom summary block, in two tables that answer two different questions. The first builds the
// debt — Robocizna przed rabatem, the Rabat, materiały, then Łącznie. Below it, one table per
// settlement tor, where wpłaty pay that Łącznie down to what is left to pay.
export function SettlementSummary({
  investmentId,
  laborCostsNetFromKosztorys,
  materialsBilled,
  settlementGroups,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  preview = false,
}: PropsT) {
  // The scream compares client-view nets; a subcontractor view reprices the displayed figure, so the
  // scream would sit next to a number it isn't comparing. Show it only in the client view.
  const reconVisible = !preview && priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  // Only while the scream is visible; otherwise the row follows the normal „rabat > 0" rule.
  const showRabat =
    rabatAmount > 0 ||
    (reconVisible && (reconciliation.rabat.actual > 0 || reconciliation.rabat.mismatch))
  const sumaPrac = moneyPair(sumaPracPreRabat(laborCostsNetFromKosztorys, rabatAmount), vatRate)
  // Rabat lives on the prace plane and grosses — brutto = rabat×(1+VAT) — so both axes read a real
  // figure. It renders negative: it is a deduction step, and a positive figure in a subtracted row
  // reads as if it were being added.
  const rabat = moneyPair(-rabatAmount, vatRate)
  const combined = combinedPair(laborCostsNetFromKosztorys, materialsBilled, vatRate)

  const moneyCols = summaryMoneyCols(MONEY_AXIS)

  return (
    <div className="text-foreground flex flex-col items-start gap-x-12 gap-y-8 text-sm">
      <div className="flex w-fit flex-col gap-8">
        <SummaryBreakdownTable
          cols={moneyCols}
          moneyAxis={MONEY_AXIS}
          sumaPrac={sumaPrac}
          sumaPracMismatch={
            reconVisible && reconciliation.laborCosts.mismatch
              ? mismatchTooltip(reconciliation.laborCosts, 'Transakcje robocizny')
              : undefined
          }
          rabat={showRabat ? rabat : undefined}
          materialsBilled={materialsBilled}
          combined={combined}
          rabatMismatch={
            reconVisible && reconciliation.rabat.mismatch
              ? mismatchTooltip(reconciliation.rabat, 'Transakcje rabatu')
              : undefined
          }
        />
        {settlementGroups.map((group, index) => (
          <SummaryTotalsTable
            key={group.caption ?? index}
            // A two-column group lines its Netto/Brutto up with the breakdown above; a single-plane
            // one spans both tracks so the tables still end on the same edge.
            cols={group.axis === 'both' ? moneyCols : SETTLEMENT_COLS}
            caption={group.caption}
            axis={group.axis}
            rows={group.rows}
            investmentId={investmentId}
            preview={preview}
          />
        ))}
      </div>
    </div>
  )
}
