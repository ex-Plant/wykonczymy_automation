import type { DayT } from '@/lib/fleet/days'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { VehicleStatusT } from '@/lib/fleet/vehicle-status'

/**
 * The manual marks on a vehicle: „this car needs its oil changed / new tyres", typed by a human
 * rather than derived from a deadline. Stored as the DAY the mark was made, not a boolean — that day
 * is what lets the mark clear itself (see `activeFlags`) instead of rotting until somebody unticks it.
 */
export type VehicleFlagsT = Partial<Record<InspectionTypeT, DayT>>

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
  cost: number
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
