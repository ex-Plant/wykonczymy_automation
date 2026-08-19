import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
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

  const byType = INSPECTION_TYPES.map((type) => {
    const ofType = costed.filter((entry) => entry.type === type)

    return {
      type,
      count: ofType.length,
      total: ofType.reduce((sum, entry) => sum + entry.cost, 0),
    }
  }).filter((bucket) => bucket.count > 0)

  return {
    byType,
    total: costed.reduce((sum, entry) => sum + entry.cost, 0),
    entries: [...costed].sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
  }
}
