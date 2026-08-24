import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { DeadlineBucketT } from '@/lib/fleet/thresholds'
import type { VehicleRecordT } from '@/lib/fleet/types'

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

export type FleetRowT = VehicleRecordT & {
  deadlines: Record<InspectionTypeT, FleetDeadlineT>
  /** The stored „do wymiany" marks minus whatever the history has already answered. */
  activeFlags: InspectionTypeT[]
  /** Newest reading known for the car, from an inspection of any type. */
  latestOdometer: number | null
  /** Distance since the last oil change; `null` when either reading is missing. */
  kmSinceOilChange: number | null
}

export type InspectionHistoryEntryT = {
  id: number
  type: InspectionTypeT
  performedAt: string
  nextDueAt: string | null
  odometer: number | null
  nextDueOdometer: number | null
  cost: number
  note: string
  attachmentCount: number
  /** Distance since the previous event of the same type; `null` when either reading is missing. */
  kmSincePrevious: number | null
}

export type VehicleDetailT = {
  vehicle: FleetRowT
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}
