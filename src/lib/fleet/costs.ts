import { toWarsawDay } from '@/lib/fleet/days'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { ALL_TIME, isWithinRange, type DateRangeT } from '@/lib/utils/date-range'
import { groupInOrder } from '@/lib/utils/group-in-order'
import type { InspectionHistoryEntryT } from '@/types/fleet'

export type TypeCostT = {
  type: InspectionTypeT
  count: number
  total: number
}

export type CostEntryT = {
  id: number
  type: InspectionTypeT
  performedAt: string
  cost: number | null
}

export type VehicleCostsT = {
  byType: TypeCostT[]
  total: number
  /** Every entry, newest first — the itemisation behind the totals. */
  entries: CostEntryT[]
}

/**
 * What a set of inspections cost inside a window. The one implementation both the vehicle card and
 * the fleet listing call, so the same car cannot show two different totals on two screens.
 *
 * `performedAt` is normalised before comparing: the listing hands over raw stored timestamps, and
 * `'2026-07-31T00:00:00Z' <= '2026-07-31'` is false as a string — that przegląd falls on the
 * window's last Warsaw day, yet the raw compare would drop it.
 *
 * An unknown cost is skipped, not read as zero: adding it in would let „nobody typed a price" quietly
 * lower the average and make the total claim a precision it does not have.
 */
export const sumCosts = (
  entries: readonly { performedAt: string; cost: number | null }[],
  range: DateRangeT,
): number =>
  entries.reduce(
    (sum, entry) =>
      entry.cost !== null && isWithinRange(toWarsawDay(entry.performedAt), range)
        ? sum + entry.cost
        : sum,
    0,
  )

/**
 * What the car has cost so far, derived from the history already on the page — no second query.
 *
 * A type with no inspection at all is left OUT rather than shown as 0 zł: „we have never done this"
 * is not the claim „it was free", and a row of zeroes reads as the latter. An event whose cost is
 * unknown still counts towards its type's `count` — it happened — but not towards its `total`.
 */
export const summariseCosts = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
): VehicleCostsT => {
  const costed = INSPECTION_TYPES.flatMap((type) =>
    historyByType[type].map((entry) => ({
      id: entry.id,
      type,
      performedAt: entry.performedAt,
      cost: entry.cost,
    })),
  )

  const grouped = groupInOrder(costed, (entry) => entry.type)

  // Iterating INSPECTION_TYPES rather than the Map's keys keeps the table in the domain's order
  // rather than in whichever type happened to be serviced first.
  const byType = INSPECTION_TYPES.flatMap((type) => {
    const ofType = grouped.get(type)
    if (!ofType) return []

    return [{ type, count: ofType.length, total: sumCosts(ofType, ALL_TIME) }]
  })

  return {
    byType,
    total: sumCosts(costed, ALL_TIME),
    entries: costed.sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
  }
}
