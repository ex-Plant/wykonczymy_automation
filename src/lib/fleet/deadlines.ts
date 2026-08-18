import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { InspectionEventT } from '@/lib/fleet/types'

export type TypeDeadlineT = {
  type: InspectionTypeT
  /** The newest event of this type, or `null` when it has never been recorded. */
  latest: InspectionEventT | null
  nextDueAt: string | null
  /** Distance covered between the two newest events of this type; `null` when unknowable. */
  kmSincePrevious: number | null
}

const byPerformedAtDesc = (a: InspectionEventT, b: InspectionEventT) =>
  b.performedAt.localeCompare(a.performedAt)

/**
 * Reduce a vehicle's whole inspection history to its current state — one entry per type.
 *
 * "Current" is the newest event **by `performedAt`**, not by due date: a backdated correction entered
 * late must not become the current deadline. This derivation is why no vehicle row stores a
 * last/next date — recording a new event retires the old deadline by itself.
 */
export const resolveDeadlines = (
  events: readonly InspectionEventT[],
): Record<InspectionTypeT, TypeDeadlineT> => {
  const result = {} as Record<InspectionTypeT, TypeDeadlineT>

  for (const type of INSPECTION_TYPES) {
    const ofType = events.filter((candidate) => candidate.type === type).sort(byPerformedAtDesc)
    const [latest, previous] = ofType

    result[type] = {
      type,
      latest: latest ?? null,
      nextDueAt: latest?.nextDueAt ?? null,
      // null, never 0: a missing reading and a stationary car are different facts.
      kmSincePrevious:
        latest?.odometer != null && previous?.odometer != null
          ? latest.odometer - previous.odometer
          : null,
    }
  }

  return result
}

/**
 * The most recent mileage known for the vehicle, from an inspection of ANY type — the oil change's
 * kilometre target is judged against whatever reading arrived last, not only against oil changes.
 */
export const latestOdometerReading = (events: readonly InspectionEventT[]): number | null =>
  [...events].sort(byPerformedAtDesc).find((candidate) => candidate.odometer != null)?.odometer ??
  null
