import type { InspectionTypeT, VehicleStatusT } from '@/lib/fleet/inspection-types'
import type { DeadlineBucketT } from '@/lib/fleet/thresholds'

/**
 * One deadline cell on the fleet listing. `hasEvent` is what separates "nothing recorded" from
 * "recorded, nothing due" — the two must not render the same, or a blind spot reads as healthy.
 */
export type FleetDeadlineT = {
  nextDueAt: string | null
  daysLeft: number | null
  bucket: DeadlineBucketT | null
  hasEvent: boolean
}

export type FleetRowT = {
  id: number
  registration: string
  make: string
  model: string
  year: number | null
  vin: string
  status: VehicleStatusT
  deadlines: Record<InspectionTypeT, FleetDeadlineT>
}

export type InspectionHistoryEntryT = {
  id: number
  type: InspectionTypeT
  performedAt: string
  nextDueAt: string | null
  odometer: number | null
  nextDueOdometer: number | null
  cost: number | null
  note: string
  attachmentCount: number
  /** Distance since the previous event of the same type; `null` when either reading is missing. */
  kmSincePrevious: number | null
}

export type VehicleDetailT = {
  vehicle: FleetRowT
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}
