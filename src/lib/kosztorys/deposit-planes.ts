import { toNet } from '@/lib/kosztorys/calc'
import type { VatPlaneT } from '@/lib/constants/transfers'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

// SPIKE (2026-08-23) — nothing crosses VAT any more. A wpłata carries the figures it actually had:
// gotówka is one netto kwota and has no brutto at all, a przelew is booked with BOTH kwoty off the
// faktura (`amount` brutto, `netAmount` its netto). The old model derived the missing side at flat
// VAT, which cannot be right on a bill built from two rates — materiały enter tryb brutto at the
// shop's 23% while robocizna grosses at the faktura's, so grossing a wpłata by the faktura rate
// credited the client money he never paid (owner, 2026-08-23).
export type DepositRowT = {
  amount: number
  // The netto off the faktura, stored only on a wpłata brutto. Deliberately NOT derivable: it
  // differs from `amount ÷ (1+VAT)` by exactly the materiały share, which is the whole point.
  netAmount: number | null
  vatPlane: VatPlaneT | null
}

// A wpłata on both planes, where `gross: null` means „nie dotyczy" — a wpłata netto has no brutto
// kwota, and inventing one is what this spike removes.
export type DepositPairT = { net: number; gross: number | null }

/** The four sums a set of wpłaty reduces to. Four rather than two because the legacy bridge below
 *  needs the VAT rate, and the listing sums these in SQL where no rate is in reach — so the raw
 *  sums travel and the bridge is applied once, in `depositPairFromPlaneSums`, by both sides. */
export type DepositPlaneSumsT = {
  // Σ of the wpłaty netto — they ARE the netto plane, in full.
  paidNet: number
  // Σ of the netto kwoty of wpłaty brutto, where the faktura named one.
  paidGrossNet: number
  // Σ of the brutto kwoty of wpłaty brutto carrying NO netto — only these cross the legacy bridge.
  paidGrossLegacy: number
  // Σ on the brutto plane: wpłaty brutto ONLY. Complete only where a wpłata netto cannot occur —
  // i.e. tryb brutto, which is the only tryb that renders this column.
  paidGross: number
  // How MANY wpłaty make up `paidNet`. A sum cannot say „ile" and the warning has to (EX-724): the
  // listing folds its wpłaty in SQL and never sees a row, so the count travels with the money.
  paidNetCount: number
}

export const isGross = (row: { vatPlane: VatPlaneT | null }) => row.vatPlane === 'GROSS'

// Legacy bridge, spike-only: a wpłata brutto booked before `netAmount` existed has no netto to read.
// Dividing at VAT is precisely the derivation this model rejects, so it is here to keep pre-spike
// rows legible, not because it is right — those rows are corrected by anulowanie i re-księgowanie.
const legacyNet = (amount: number, vatRate: number) => toNet(amount, vatRate)

export function depositRowPair(row: DepositRowT, vatRate: number): DepositPairT {
  if (!isGross(row)) return { net: row.amount, gross: null }
  return { net: row.netAmount ?? legacyNet(row.amount, vatRate), gross: row.amount }
}

export const NO_DEPOSIT_SUMS: DepositPlaneSumsT = {
  paidNet: 0,
  paidGrossNet: 0,
  paidGrossLegacy: 0,
  paidGross: 0,
  paidNetCount: 0,
}

export function bucketDepositsByPlane(rows: DepositRowT[]): DepositPlaneSumsT {
  return rows.reduce<DepositPlaneSumsT>((acc, row) => {
    if (!isGross(row)) {
      return { ...acc, paidNet: acc.paidNet + row.amount, paidNetCount: acc.paidNetCount + 1 }
    }
    return {
      ...acc,
      paidGross: acc.paidGross + row.amount,
      paidGrossNet: acc.paidGrossNet + (row.netAmount ?? 0),
      paidGrossLegacy: acc.paidGrossLegacy + (row.netAmount == null ? row.amount : 0),
    }
  }, NO_DEPOSIT_SUMS)
}

// The one place the sums become the pair the settlement subtracts — so the panel (which reduces
// rows) and the listing (which reduces in SQL) can never apply the legacy bridge by two rules.
export function depositPairFromPlaneSums(
  { paidNet, paidGrossNet, paidGrossLegacy, paidGross }: DepositPlaneSumsT,
  vatRate: number,
): MoneyPairT {
  return {
    net: paidNet + paidGrossNet + legacyNet(paidGrossLegacy, vatRate),
    gross: paidGross,
  }
}

// Σ of a set of wpłaty on each plane — the deduction step every tryb subtracts from „Łącznie".
export function sumDeposits(rows: DepositRowT[], vatRate: number): MoneyPairT {
  return depositPairFromPlaneSums(bucketDepositsByPlane(rows), vatRate)
}

// A wpłata recorded on the plane the investment does NOT settle on. What it actually says is that
// the DEAL is mieszany and the tryb has not caught up (owner, 2026-08-23) — which is why the remedy
// every surface names is „ustaw rozliczenie mieszane", not „przeksięguj wpłatę". Tryb mieszany can
// therefore never raise it: it is the answer. Untagged counts as gotówka („brak wartości = netto",
// owner 2026-07-23), so in tryb brutto every legacy untagged wpłata shows up here — deliberately,
// they are not backfilled.
//
// Both directions, but they do not cost the same — see `strandsDeposit` for the one that loses
// money, which is what decides how loudly each is said.
export function isOffPlaneDeposit(
  row: { vatPlane: VatPlaneT | null },
  mode: SettlementModeT,
): boolean {
  if (mode === 'MIXED') return false
  return mode === 'NET' ? row.vatPlane === 'GROSS' : row.vatPlane !== 'GROSS'
}

// Those wpłaty themselves — the warning counts them and adds up what they are worth, and the wpłaty
// list tones the same rows red so the count can be traced back to actual rows.
export function offPlaneDeposits<RowT extends { vatPlane: VatPlaneT | null }>(
  rows: RowT[],
  mode: SettlementModeT,
): RowT[] {
  return rows.filter((row) => isOffPlaneDeposit(row, mode))
}

// The one direction that actually costs money, and therefore the only one that stops a booking to
// ask (owner, 2026-08-23). A gotówka on an investment settled brutto has no brutto kwota at all —
// since nothing is derived at VAT, the settlement counts it as zero and the client reads as not
// having paid. The reverse — a przelew where the bill is netto — still pays the debt down at the
// netto its faktura names, so the tryb is wrong there but no złoty is lost.
//
// Narrower than `isOffPlaneDeposit` on purpose: that one answers „is the tryb still telling the
// truth" (both directions), this one „does this wpłata vanish" (the half that earns a red scream and
// a confirm dialog).
export function strandsDeposit(
  plane: VatPlaneT | null | undefined,
  mode: SettlementModeT,
): boolean {
  return mode === 'GROSS' && plane !== 'GROSS'
}

// How many wpłaty a tryb brutto leaves unpaid, and what they are worth — the figures every surface
// that has to name the damage says out loud.
export type StrandedDepositsT = { count: number; amount: number }

// The same damage read off the SQL sums instead of the rows, for the listing, which folds its wpłaty
// in Postgres and never holds one (EX-724). The netto bucket IS the stranded set: it is filtered by
// „plane is not GROSS", which is exactly what `strandsDeposit` asks. `undefined` rather than a zero
// pair because nothing is wrong then, and the marker is the absence of a marker.
export function strandedFromPlaneSums(
  { paidNet, paidNetCount }: DepositPlaneSumsT,
  mode: SettlementModeT,
): StrandedDepositsT | undefined {
  // `null` is the bucket's own plane — untagged counts as gotówka — so the rule is asked, not copied.
  if (!strandsDeposit(null, mode) || paidNetCount === 0) return undefined
  return { count: paidNetCount, amount: paidNet }
}

// What flipping the tryb would cost, counted BEFORE the flip. The tryb is a fact the owner may
// change after wpłaty exist, and nothing is rewritten when he does — the same rows simply stop
// counting. So the switch owes the same sentence the booking does, with the damage already added up.
export function depositsStrandedBy<RowT extends { vatPlane: VatPlaneT | null; amount: number }>(
  rows: RowT[],
  nextMode: SettlementModeT,
): StrandedDepositsT {
  const stranded = rows.filter((row) => strandsDeposit(row.vatPlane, nextMode))
  return {
    count: stranded.length,
    amount: stranded.reduce((sum, row) => sum + row.amount, 0),
  }
}
