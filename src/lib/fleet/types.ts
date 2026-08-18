import type { InspectionTypeT, VehicleStatusT } from '@/lib/fleet/inspection-types'

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

export type VehicleSummaryT = {
  id: number
  registration: string
  make: string
  model: string
  status: VehicleStatusT
}
