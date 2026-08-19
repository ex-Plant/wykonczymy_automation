import type { VatPlaneT } from '@/lib/constants/transfers'

type DepositTallyT = { total: number; count: number }

export type DepositPlaneSumsT = {
  paidNet: number
  paidGross: number
  // Σ of the very rows the two buckets partition, returned from the one place that already reduces
  // them — so „Wpłaty" and the wpłaty list it sits above cannot be summed by two different rules.
  total: number
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
// null→brutto default).
export function bucketDepositsByPlane(
  rows: { amount: number; vatPlane: VatPlaneT | null }[],
): DepositPlaneSumsT {
  const taggedGross = tally(rows, 'GROSS')
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return {
    paidNet: total - taggedGross.total,
    paidGross: taggedGross.total,
    total,
  }
}
