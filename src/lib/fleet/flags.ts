import { toWarsawDay, type DayT } from '@/lib/fleet/days'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { InspectionEventT } from '@/lib/fleet/types'

/**
 * The manual marks on a vehicle: „this car needs its oil changed / new tyres", typed by a human
 * rather than derived from a deadline. Stored as the DAY the mark was made, not a boolean — that day
 * is what lets the mark clear itself (see `activeFlags`) instead of rotting until somebody unticks it.
 */
export type VehicleFlagsT = Partial<Record<InspectionTypeT, DayT>>

const isDay = (value: unknown): value is DayT =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/**
 * The column is `jsonb`, so what comes back is whatever was last written — including `null` from
 * every vehicle that predates the feature. Unknown keys and non-day values are dropped rather than
 * trusted: a flag on a type that no longer exists would be invisible in the UI and unclearable.
 */
export const parseVehicleFlags = (raw: unknown): VehicleFlagsT => {
  if (typeof raw !== 'object' || raw === null) return {}

  const source = raw as Record<string, unknown>

  return Object.fromEntries(
    INSPECTION_TYPES.filter((type) => isDay(source[type])).map((type) => [type, source[type]]),
  )
}

/**
 * Which marks still stand. A mark is retired by an inspection of its type performed within
 * `[flaggedAt, today]` — so recording the work clears the alarm by itself, exactly as a new event
 * retires the old deadline (see `deadlines.ts`), and no write-back is needed on the inspection path.
 *
 * Both ends of that window are load-bearing. The lower one makes backfilling safe: entering a service
 * from last year cannot silence a mark made today. The upper one keeps a FUTURE-dated event from
 * doing it — a booked appointment is work that has not happened, and the mark is precisely the thing
 * saying it still needs to.
 *
 * Returned in INSPECTION_TYPES order, never the stored object's, so the badges keep the domain's
 * order regardless of which type happened to be flagged first.
 */
export const activeFlags = (
  flags: VehicleFlagsT,
  events: readonly InspectionEventT[],
  today: DayT,
): InspectionTypeT[] =>
  INSPECTION_TYPES.filter((type) => {
    const flaggedAt = flags[type]
    if (!flaggedAt) return false

    return !events.some((event) => {
      if (event.type !== type) return false

      const performedOn = toWarsawDay(event.performedAt)

      return performedOn >= flaggedAt && performedOn <= today
    })
  })

/**
 * The map to persist for a newly ticked set.
 *
 * A type that is already active keeps its original day — re-saving the form must not restart its
 * clock. A type being newly ticked is stamped with today, and this is the case the `active` argument
 * exists for: a mark already retired by an inspection still has its old day sitting in the map, so
 * "keep whatever is stored" would write back a day the history already covers and the tick would do
 * nothing. Anything deselected is dropped, which is also how a retired entry gets pruned.
 */
export const nextFlags = ({
  current,
  active,
  selected,
  today,
}: {
  current: VehicleFlagsT
  active: readonly InspectionTypeT[]
  selected: readonly InspectionTypeT[]
  today: DayT
}): VehicleFlagsT =>
  Object.fromEntries(
    INSPECTION_TYPES.filter((type) => selected.includes(type)).map((type) => [
      type,
      active.includes(type) ? (current[type] ?? today) : today,
    ]),
  )
