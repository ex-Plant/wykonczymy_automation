import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import { daysBetween, toWarsawDay, warsawToday } from '@/lib/fleet/days'
import { resolveDeadlines } from '@/lib/fleet/deadlines'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { classifyDeadline } from '@/lib/fleet/thresholds'
import type { InspectionEventT, VehicleSummaryT } from '@/lib/fleet/types'
import type { VehicleInspection } from '@/payload-types'
import type {
  FleetRowT,
  InspectionHistoryEntryT,
  VehicleDetailT,
  FleetDeadlineT,
} from '@/types/fleet'

export type FleetDatasetT = {
  vehicles: (VehicleSummaryT & { year: number | null; vin: string })[]
  events: (InspectionEventT & { cost: number | null; note: string; attachmentCount: number })[]
}

const asId = (value: number | { id: number }): number =>
  typeof value === 'number' ? value : value.id

export const toInspectionEvent = (row: VehicleInspection) => ({
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
  cost: row.cost ?? null,
  note: row.note ?? '',
  attachmentCount: row.attachments?.length ?? 0,
})

/**
 * The whole fleet in one cached read — a handful of cars with a few events each, so a per-vehicle
 * read would buy nothing and cost N cache entries to invalidate. Deliberately raw: nothing here
 * depends on today's date, so the entry survives midnight (see `fetchFleetOverview`).
 */
const getFleetDataset = unstable_cache(
  async (): Promise<FleetDatasetT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })

    const [vehicles, inspections] = await Promise.all([
      payload.find({
        collection: 'vehicles',
        sort: 'registration',
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'vehicle-inspections',
        sort: '-performedAt',
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    console.log(`[PERF] query.getFleetDataset ${elapsed()}ms`)

    return {
      vehicles: assertCompletePage(vehicles, 'getFleetDataset.vehicles').map((vehicle) => ({
        id: vehicle.id,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        status: vehicle.status,
        year: vehicle.year ?? null,
        vin: vehicle.vin ?? '',
      })),
      events: assertCompletePage(inspections, 'getFleetDataset.inspections').map(toInspectionEvent),
    }
  },
  ['fleet-dataset'],
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
  events: FleetDatasetT['events'],
  today: string,
): FleetRowT => {
  const deadlines = resolveDeadlines(events)

  return {
    ...vehicle,
    deadlines: Object.fromEntries(
      INSPECTION_TYPES.map((type) => [
        type,
        toDeadline(deadlines[type].nextDueAt, deadlines[type].latest !== null, today),
      ]),
    ) as Record<InspectionTypeT, FleetDeadlineT>,
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

  return vehicles.map((vehicle) =>
    toRow(
      vehicle,
      events.filter((event) => event.vehicleId === vehicle.id),
      today,
    ),
  )
}

/**
 * One type's events, newest first, each carrying the distance since the entry below it. The delta is
 * `null` — never 0 — whenever either reading is missing, so "unknown" stays distinguishable from
 * "the car didn't move".
 */
export const historyOfType = (
  events: FleetDatasetT['events'],
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
    historyByType: Object.fromEntries(
      INSPECTION_TYPES.map((type) => [type, historyOfType(ofVehicle, type)]),
    ) as Record<InspectionTypeT, InspectionHistoryEntryT[]>,
  }
}
