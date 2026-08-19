import type { VehicleFlagsT } from '@/lib/fleet/flags'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { VehicleStatusT } from '@/lib/fleet/vehicle-status'

/**
 * One inspection event, flattened to plain data so every rule in this directory is testable without
 * Payload or a DB. `vehicleId` is the id, never a populated document.
 */
export type InspectionEventT = {
  id: number
  vehicleId: number
  type: InspectionTypeT
  performedAt: string
  nextDueAt: string | null
  odometer: number | null
  nextDueOdometer: number | null
  notifiedThreshold: number | null
  notifiedAt: string | null
  odometerNotifiedAt: string | null
}

/** An inspection plus the fields only the UI reads — what the loaders actually return. */
export type InspectionRecordT = InspectionEventT & {
  cost: number | null
  note: string
  attachmentCount: number
}

export type VehicleSummaryT = {
  id: number
  registration: string
  make: string
  model: string
  status: VehicleStatusT
}

export type VehicleRecordT = VehicleSummaryT & {
  year: number | null
  vin: string
  flags: VehicleFlagsT
}

/** One vehicle with the events recorded against it — what every sweep rule reads. */
export type VehicleHistoryT = {
  vehicle: VehicleSummaryT
  events: readonly InspectionEventT[]
}
