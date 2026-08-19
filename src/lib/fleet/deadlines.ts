import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { InspectionEventT } from '@/lib/fleet/types'

const byPerformedAtDesc = (a: InspectionEventT, b: InspectionEventT) =>
  b.performedAt.localeCompare(a.performedAt)

/**
 * Reduce a vehicle's whole inspection history to its current state — the newest event of each type,
 * or `null` where that type has never been recorded.
 *
 * "Current" is the newest event **by `performedAt`**, not by due date: a backdated correction entered
 * late must not become the current deadline. This derivation is why no vehicle row stores a
 * last/next date — recording a new event retires the old deadline by itself.
 *
 * Sorts rather than trusting the caller: every rule in this directory is a pure function of the
 * events handed to it, and one order-dependent exception would be invisible until it misfired.
 */
export const latestByType = <T extends InspectionEventT>(
  events: readonly T[],
): Record<InspectionTypeT, T | null> => {
  const newestFirst = [...events].sort(byPerformedAtDesc)

  return byInspectionType((type) => newestFirst.find((event) => event.type === type) ?? null)
}

/**
 * The most recent mileage known for the vehicle, from an inspection of ANY type — the oil change's
 * kilometre target is judged against whatever reading arrived last, not only against oil changes.
 */
export const latestOdometerReading = (events: readonly InspectionEventT[]): number | null =>
  [...events].sort(byPerformedAtDesc).find((candidate) => candidate.odometer != null)?.odometer ??
  null

/**
 * Distance covered since the last oil change: the newest reading of ANY type minus the reading taken
 * at the newest oil change. `null` when either is missing — an unknown distance is not zero.
 */
export const kmSinceOilChange = (events: readonly InspectionEventT[]): number | null => {
  const lastOilChange = latestByType(events).OIL_CHANGE
  const latest = latestOdometerReading(events)

  return latest != null && lastOilChange?.odometer != null ? latest - lastOilChange.odometer : null
}
