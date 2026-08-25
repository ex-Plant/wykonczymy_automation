import type { VatPlaneT } from '@/lib/constants/transfers'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { DepositPlaneSumsT } from '@/lib/kosztorys/deposit-planes'

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

// The damage a tryb brutto does, in the two figures every surface that has to name it says out loud.
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
