import type { InspectionEventT } from '@/lib/fleet/types'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'

let nextId = 1

/** An inspection row with everything unset except what the spec is about. */
export const event = (
  type: InspectionTypeT,
  performedAt: string,
  overrides: Partial<InspectionEventT> = {},
): InspectionEventT => ({
  id: nextId++,
  vehicleId: 1,
  type,
  performedAt,
  nextDueAt: null,
  odometer: null,
  nextDueOdometer: null,
  notifiedThreshold: null,
  notifiedAt: null,
  odometerNotifiedAt: null,
  ...overrides,
})
