import { roundToCents } from '@/lib/utils/round-to-cents'
import type { VatPlaneT } from '@/lib/constants/transfers'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { DepositTallyT } from '@/lib/kosztorys/summary-economics'

// One figure's reconciliation verdict: the kosztorys client-view NET vs the transaction-sourced
// figure, and whether they disagree. Shared contract — the editor Podsumowanie and the investment
// page both render off this shape.
//
// Both sides are netto. VAT is a client-pricing concept (prace only); the transaction ledger carries
// no VAT axis, so the check compares net-to-net — grossing the kosztorys side would false-fire by the
// whole VAT amount (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac").

export type ReconT = {
  // Kosztorys side: the client-view net („Suma prac wykonanych" / rabat).
  expected: number
  // Transaction side: Σ LABOR_COST / Σ RABAT (raw amount — the schema is already netto, no VAT).
  actual: number
  mismatch: boolean
}

export type KosztorysReconciliationT = {
  laborCosts: ReconT
  rabat: ReconT
}

type InputT = {
  // „Suma prac wykonanych" at client prices, pre-rabat (net) — lines up with Σ LABOR_COST.
  sumaPracNet: number
  // The client-view rabat (net) — global discount when active, else Σ per-item rabat.
  rabatClientNet: number
  // Transaction-sourced robocizna: Σ LABOR_COST on the investment (netto).
  laborCostsNetFromTransactions: number
  // Transaction-sourced rabat: Σ RABAT on the investment (netto).
  investmentRabat: number
}

// Exact grosz equality on rounded values, not a fuzzy epsilon: a hand-entered transfer can differ
// sub-grosz from the derived figure, and that must NOT fire — only a real ≥1-grosz gap is a mismatch.
function reconcile(expected: number, actual: number): ReconT {
  const mismatch = roundToCents(expected) !== roundToCents(actual)
  return { expected, actual, mismatch }
}

/**
 * The scream's tooltip copy, shared by both surfaces (the editor Podsumowanie and the investment page)
 * so the wording can't drift. Format-agnostic: the caller passes its own money formatter — the editor
 * shows kosztorys nets via `formatNet`, the investment page złoty via `formatPLN`. Both figures are
 * netto — the copy says so, so the two surfaces can't be read as comparing different money axes.
 */
export function reconciliationTooltip(
  recon: ReconT,
  transactionSubject: string,
  format: (value: number) => string,
): string {
  return [
    `Kosztorys (netto, ceny klienta): ${format(recon.expected)}`,
    `${transactionSubject} (netto): ${format(recon.actual)}`,
    `Różnica: ${format(recon.actual - recon.expected)}`,
    'Zweryfikuj przed oznaczeniem inwestycji jako rozliczonej.',
  ].join('\n')
}

export type SettlementPlaneVerdictT = {
  mismatch: boolean
  mode: SettlementModeT
  // The wpłaty that sit on the wrong plane (netto sum for a GROSS investment, and vice versa), and
  // which plane that is. Named here rather than re-derived at the render site, where a two-branch
  // ternary over a three-value mode would quietly mislabel `MIXED`.
  offendingAmount: number
  offendingCount: number
  offendingPlane: VatPlaneT | null
}

/**
 * A deposit whose plane contradicts the declared settlement mode records normally but must be seen:
 * either the mode is wrong or the wpłata was tagged wrong, and both are invisible in the totals.
 * `MIXED` is settled on both planes, so nothing can contradict it.
 *
 * Reads the **tagged** tallies from `bucketDepositsByPlane`, never `paidNet` / `paidGross`. Those
 * fold unmarked deposits into netto under the null→netto settlement ruling, which is right for
 * settling and wrong as evidence: an unmarked deposit says nothing about its plane, so counting it
 * fired this warning on every brutto investment where nobody had tagged anything.
 */
export function buildSettlementPlaneVerdict({
  mode,
  taggedNet,
  taggedGross,
}: {
  mode: SettlementModeT
  taggedNet: DepositTallyT
  taggedGross: DepositTallyT
}): SettlementPlaneVerdictT {
  const offendingPlane = mode === 'NET' ? 'GROSS' : mode === 'GROSS' ? 'NET' : null
  const offending =
    offendingPlane === 'GROSS' ? taggedGross : offendingPlane === 'NET' ? taggedNet : null
  return {
    mismatch: (offending?.count ?? 0) > 0,
    mode,
    offendingAmount: offending?.total ?? 0,
    offendingCount: offending?.count ?? 0,
    offendingPlane,
  }
}

/**
 * Compare the kosztorys client-view figures against the investment's transaction sums, for both
 * robocizna and rabat — net to net. The verification instrument the owner reads before flipping an
 * investment to "populated"; read-only, no writes.
 *
 * A real lib function (not a colocated closure) so the parity test exercises the exact code the
 * surfaces render (`context/foundation/lessons.md`).
 */
export function buildKosztorysReconciliation({
  sumaPracNet,
  rabatClientNet,
  laborCostsNetFromTransactions,
  investmentRabat,
}: InputT): KosztorysReconciliationT {
  const laborCosts = reconcile(sumaPracNet, laborCostsNetFromTransactions)
  const rabat = reconcile(rabatClientNet, investmentRabat)

  // Nothing on the transactions plane at all ⇒ nothing to reconcile against. Since the write-switch
  // (EX-555) no new LABOR_COST or RABAT can be booked, so every investment created from here on would
  // otherwise scream forever — an alarm that fires on everything verifies nothing. The alert exists
  // for the OLD investments, which do carry bookings.
  //
  // Silenced per INVESTMENT, never per figure: a per-figure rule would mute „robocizna zaksięgowana,
  // rabat nie", which is precisely the gap `showDiscount` (settlement-summary.tsx) forces onto the screen.
  // Both verdicts go quiet together or neither does.
  const nothingBooked = laborCostsNetFromTransactions === 0 && investmentRabat === 0
  if (nothingBooked) {
    return {
      laborCosts: { ...laborCosts, mismatch: false },
      rabat: { ...rabat, mismatch: false },
    }
  }

  return { laborCosts, rabat }
}
