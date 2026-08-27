import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { isWithinRange, type DateRangeT } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

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

/**
 * „w wybranym okresie" blames the window, so it may only be said when the window is what emptied the
 * section — not merely because one is set. A car that has never had an OC keeps saying „Brak wpisów"
 * while a window is active; otherwise the user reads „nothing in July", widens the window and finds
 * nothing there either. Written once because both surfaces that render it must agree.
 */
export const emptyHistoryLabel = (noun: string, hiddenByWindow: boolean): string =>
  hiddenByWindow ? `Brak ${noun} w wybranym okresie` : `Brak ${noun}`
