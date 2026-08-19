import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
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
  cost: number
}

export type VehicleCostsT = {
  byType: TypeCostT[]
  total: number
  /** Every costed entry, newest first — the itemisation behind the totals. */
  entries: CostEntryT[]
}

/**
 * What the car has cost so far, derived from the history already on the page — no second query.
 *
 * A type with no costed entry is left OUT rather than shown as 0 zł: nobody recorded a price there,
 * which is not the same claim as "it was free", and a column of zeroes reads as the latter.
 */
export const summariseCosts = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
): VehicleCostsT => {
  const costed = INSPECTION_TYPES.flatMap((type) =>
    historyByType[type]
      .filter((entry): entry is InspectionHistoryEntryT & { cost: number } => entry.cost !== null)
      .map((entry) => ({ id: entry.id, type, performedAt: entry.performedAt, cost: entry.cost })),
  )

  const grouped = groupInOrder(costed, (entry) => entry.type)

  // Iterating INSPECTION_TYPES rather than the Map's keys keeps the table in the domain's order
  // rather than in whichever type happened to be costed first.
  const byType = INSPECTION_TYPES.flatMap((type) => {
    const ofType = grouped.get(type)
    if (!ofType) return []

    return [
      { type, count: ofType.length, total: ofType.reduce((sum, entry) => sum + entry.cost, 0) },
    ]
  })

  return {
    byType,
    total: byType.reduce((sum, bucket) => sum + bucket.total, 0),
    entries: costed.sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
  }
}
