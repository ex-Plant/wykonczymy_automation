import { isExempt } from '@/lib/fleet/exemptions'
import {
  SCHEDULED_INSPECTION_TYPES,
  type ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import type { VehicleHistoryT } from '@/lib/fleet/types'

export type MissingInspectionT = {
  vehicleId: number
  registration: string
  type: ScheduledInspectionTypeT
}

/**
 * The (vehicle, type) pairs with zero events — the blind spot the threshold logic structurally cannot
 * cover, since no event means no due date and therefore no bucket that could ever fire. Fed only to
 * the digest's weekly section, so a never-recorded inspection surfaces once a week instead of never.
 *
 * Only the scheduled types: an ad-hoc SERVICE has no schedule to be absent from, so a car that has
 * simply never needed one would otherwise be nagged about it every week forever.
 *
 * A recorded event with no due date does NOT count as missing: that is a data gap on a known event,
 * visible on the vehicle page, not an absent inspection. Neither does a type the car is exempt from —
 * the przyczepa's przegląd is „bezterminowo", so its absence is the answer, not a blind spot.
 */
export const findMissingInspections = (
  histories: readonly VehicleHistoryT[],
): MissingInspectionT[] =>
  histories
    .filter(({ vehicle }) => vehicle.status === 'ACTIVE')
    .flatMap(({ vehicle, events }) =>
      SCHEDULED_INSPECTION_TYPES.filter(
        (type) =>
          !isExempt(vehicle.exemptions, type) &&
          !events.some((candidate) => candidate.type === type),
      ).map((type) => ({ vehicleId: vehicle.id, registration: vehicle.registration, type })),
    )
