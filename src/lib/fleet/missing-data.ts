import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { VehicleHistoryT } from '@/lib/fleet/types'

export type MissingInspectionT = {
  vehicleId: number
  registration: string
  type: InspectionTypeT
}

/**
 * The (vehicle, type) pairs with zero events — the blind spot the threshold logic structurally cannot
 * cover, since no event means no due date and therefore no bucket that could ever fire. Fed only to
 * the digest's weekly section, so a never-recorded inspection surfaces once a week instead of never.
 *
 * A recorded event with no due date does NOT count as missing: that is a data gap on a known event,
 * visible on the vehicle page, not an absent inspection.
 */
export const findMissingInspections = (
  histories: readonly VehicleHistoryT[],
): MissingInspectionT[] =>
  histories
    .filter(({ vehicle }) => vehicle.status === 'ACTIVE')
    .flatMap(({ vehicle, events }) =>
      INSPECTION_TYPES.filter((type) => !events.some((candidate) => candidate.type === type)).map(
        (type) => ({ vehicleId: vehicle.id, registration: vehicle.registration, type }),
      ),
    )
