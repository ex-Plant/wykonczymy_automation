import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { groupByVehicle, loadFleetDataset, type FleetDatasetT } from '@/lib/fleet/dataset'
import { daysBetween, toWarsawDay, warsawToday } from '@/lib/fleet/days'
import { activeFlags } from '@/lib/fleet/flags'
import { kmSinceOilChange, latestByType, latestOdometerReading } from '@/lib/fleet/deadlines'
import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { classifyDeadline } from '@/lib/fleet/thresholds'
import type { InspectionRecordT } from '@/lib/fleet/types'
import type {
  FleetRowT,
  InspectionHistoryEntryT,
  VehicleDetailT,
  FleetDeadlineT,
} from '@/types/fleet'

export type { FleetDatasetT }

/**
 * Deliberately raw: nothing here depends on today's date, so the entry survives midnight (see
 * `fetchFleetOverview`).
 */
const getFleetDataset = unstable_cache(
  async (): Promise<FleetDatasetT> => {
    const elapsed = perfStart()
    const dataset = await loadFleetDataset(await getPayload({ config }))
    console.log(`[PERF] query.getFleetDataset ${elapsed()}ms`)

    return dataset
  },
  // Keyed -v3 because the payload's SHAPE has changed twice: it widened with `flags`, and `cost`
  // narrowed from `number | null` to `number`. An entry written under either older shape is still
  // valid JSON, so tags alone would keep serving it — a tag marks an entry stale but the same
  // request is still answered from it once before revalidation (lessons.md).
  ['fleet-dataset-v3'],
  { tags: [CACHE_TAGS.vehicles, CACHE_TAGS.vehicleInspections] },
)

const toDeadline = (nextDueAt: string | null, hasEvent: boolean, today: string): FleetDeadlineT => {
  const dueDay = nextDueAt ? toWarsawDay(nextDueAt) : null

  return {
    nextDueAt: dueDay,
    daysLeft: dueDay ? daysBetween(today, dueDay) : null,
    bucket: classifyDeadline(dueDay, today),
    hasEvent,
  }
}

export const toRow = (
  vehicle: FleetDatasetT['vehicles'][number],
  events: readonly InspectionRecordT[],
  today: string,
): FleetRowT => {
  const latest = latestByType(events)

  return {
    ...vehicle,
    latestOdometer: latestOdometerReading(events),
    kmSinceOilChange: kmSinceOilChange(events),
    deadlines: byInspectionType((type) =>
      toDeadline(latest[type]?.nextDueAt ?? null, latest[type] !== null, today),
    ),
    activeFlags: activeFlags(vehicle.flags, events, today),
  }
}

/**
 * The listing: one row per vehicle with its five current deadlines, classified against today.
 *
 * Today is resolved ONCE here and threaded down, so every cell on the page answers "how urgent" as of
 * the same instant — and the cached dataset above stays date-free.
 */
export async function fetchFleetOverview(): Promise<FleetRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const { vehicles, events } = await getFleetDataset()
  const today = warsawToday()

  return groupByVehicle({ vehicles, events }).map(({ vehicle, events: ofVehicle }) =>
    toRow(vehicle, ofVehicle, today),
  )
}

/**
 * One type's events, newest first, each carrying the distance since the entry below it. The delta is
 * `null` — never 0 — whenever either reading is missing, so "unknown" stays distinguishable from
 * "the car didn't move".
 */
export const historyOfType = (
  events: readonly InspectionRecordT[],
  type: InspectionTypeT,
): InspectionHistoryEntryT[] => {
  const ofType = events
    .filter((event) => event.type === type)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))

  return ofType.map((event, index) => {
    const previous = ofType[index + 1]

    return {
      id: event.id,
      type: event.type,
      performedAt: toWarsawDay(event.performedAt),
      nextDueAt: event.nextDueAt ? toWarsawDay(event.nextDueAt) : null,
      odometer: event.odometer,
      nextDueOdometer: event.nextDueOdometer,
      cost: event.cost,
      note: event.note,
      attachmentCount: event.attachmentCount,
      kmSincePrevious:
        event.odometer != null && previous?.odometer != null
          ? event.odometer - previous.odometer
          : null,
    }
  })
}

/** One vehicle with its full history, newest first, grouped by type. */
export async function fetchVehicleDetail(id: number): Promise<VehicleDetailT | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')

  const { vehicles, events } = await getFleetDataset()
  const vehicle = vehicles.find((candidate) => candidate.id === id)
  if (!vehicle) return null

  const ofVehicle = events.filter((event) => event.vehicleId === id)

  return {
    vehicle: toRow(vehicle, ofVehicle, warsawToday()),
    historyByType: byInspectionType((type) => historyOfType(ofVehicle, type)),
  }
}
