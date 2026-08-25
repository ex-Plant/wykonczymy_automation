import type { InspectionRecordT } from '@/lib/fleet/types'
import type { VehicleInspection } from '@/payload-types'

// Narrower than `resolveId`: the relation is typed `number | Vehicle`, and this stays total where
// that helper's `number | undefined` would force a cast at the one call site.
const asId = (value: number | { id: number }): number =>
  typeof value === 'number' ? value : value.id

/**
 * Lives here rather than in `lib/queries` so the sweep can map rows without importing the query
 * layer — that import pulled `@payload-config` into every spec in this directory.
 */
export const toInspectionEvent = (row: VehicleInspection): InspectionRecordT => ({
  id: row.id,
  vehicleId: asId(row.vehicle),
  type: row.type,
  performedAt: row.performedAt,
  nextDueAt: row.nextDueAt ?? null,
  odometer: row.odometer ?? null,
  nextDueOdometer: row.nextDueOdometer ?? null,
  notifiedThreshold: row.notifiedThreshold ?? null,
  notifiedAt: row.notifiedAt ?? null,
  odometerNotifiedAt: row.odometerNotifiedAt ?? null,
  cost: row.cost,
  note: row.note ?? '',
  attachmentCount: row.attachments?.length ?? 0,
})
