import type { VatPlaneT } from '@/lib/constants/transfers'

export type DepositTallyT = { total: number; count: number }

export type DepositPlaneSumsT = {
  paidNet: number
  paidGross: number
  // Σ of the very rows the two buckets partition, returned from the one place that already reduces
  // them — so „Wpłaty" and the wpłaty list it sits above cannot be summed by two different rules.
  total: number
  // Deposits whose plane was actually typed, per plane. Separate from paidNet/paidGross because the
  // null→netto ruling is a *settlement* rule, not evidence: an unmarked deposit is unknown, and
  // reading it as netto turns "nobody has tagged anything here" into a contradiction the plane
  // warning then screams about on every brutto investment.
  taggedNet: DepositTallyT
  taggedGross: DepositTallyT
}

const tally = (
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
  plane: VatPlaneT,
): DepositTallyT =>
  rows.reduce<DepositTallyT>(
    (acc, row) =>
      row.vatPlane === plane ? { total: acc.total + row.amount, count: acc.count + 1 } : acc,
    { total: 0, count: 0 },
  )

// Bucket deposits by VAT plane for the tryb-mieszany reconciliation. A deposit marked GROSS goes to
// the invoiced part; everything else — NET *and* legacy/unmarked null — pays down the gotówka
// (no-VAT) part, the owner's „brak wartości = netto" ruling (flipped 2026-07-22 from the earlier
// null→brutto default). The tagged tallies alongside keep the one place that reads `vatPlane`, so
// the settlement reading and the evidence reading can differ without a second interpretation of null.
export function bucketDepositsByPlane(
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
): DepositPlaneSumsT {
  const taggedGross = tally(rows, 'GROSS')
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return {
    paidNet: total - taggedGross.total,
    paidGross: taggedGross.total,
    total,
    taggedNet: tally(rows, 'NET'),
    taggedGross,
  }
}
