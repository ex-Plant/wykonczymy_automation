import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { isWithinRange, type DateRangeT } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/types/fleet'

/**
 * Narrow a vehicle's history to a window, per type.
 *
 * Deliberately applied to entries that are ALREADY mapped: `kmSincePrevious` was measured against the
 * event below it across the whole history, so an entry at the window's edge keeps the distance to a
 * predecessor sitting just outside it. Filter the raw events first and that distance silently becomes
 * „—" — a window would start inventing unknowns.
 *
 * `performedAt` is a Warsaw day by the time it reaches here, which is what lets the bounds be compared
 * lexically rather than parsed.
 */
export const narrowHistory = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
  range: DateRangeT,
): Record<InspectionTypeT, InspectionHistoryEntryT[]> =>
  byInspectionType((type) =>
    historyByType[type].filter((entry) => isWithinRange(entry.performedAt, range)),
  )
