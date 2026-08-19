import type { InspectionEventT, VehicleHistoryT, VehicleSummaryT } from '@/lib/fleet/types'
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

/** A vehicle with a registration derived from its id, so assertions can name one without a fixture. */
export const vehicle = (overrides: Partial<VehicleSummaryT> = {}): VehicleSummaryT => {
  const id = overrides.id ?? 1

  return {
    id,
    registration: `WX 0000${id}`,
    make: 'Ford',
    model: 'Transit',
    status: 'ACTIVE',
    ...overrides,
  }
}

export const history = (
  events: InspectionEventT[],
  overrides: Partial<VehicleSummaryT> = {},
): VehicleHistoryT => ({ vehicle: vehicle(overrides), events })
