import { toWarsawDay, daysBetween, type DayT } from '@/lib/fleet/days'
import { isExempt } from '@/lib/fleet/exemptions'
import { latestByType, latestOdometerReading } from '@/lib/fleet/deadlines'
import {
  SCHEDULED_INSPECTION_TYPES,
  type ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import { oilTarget, shouldNotify } from '@/lib/fleet/should-notify'
import { OVERDUE } from '@/lib/fleet/thresholds'
import type { VehicleHistoryT } from '@/lib/fleet/types'

export type DigestEntryT = {
  inspectionId: number
  registration: string
  make: string
  model: string
  type: ScheduledInspectionTypeT
  nextDueAt: DayT
  daysLeft: number
}

export type OdometerEntryT = {
  inspectionId: number
  registration: string
  make: string
  model: string
  /** The reading the oil is due at — the typed target, or the interval from the last change. */
  targetOdometer: number
  latestOdometer: number
  /** Negative once the target is behind us. */
  kmRemaining: number
  /** Distance covered since the change, the figure the digest announces. `null` when it had no reading. */
  kmSinceChange: number | null
}

/**
 * What to write back once the mail is out. Split by leg: a row can earn the digest on mileage while
 * its date leg stays quiet, and stamping both would silence a deadline nobody was told about.
 */
export type StampT = {
  inspectionId: number
  /** The bucket the date leg fired at, or `null` when only the kilometre leg did. */
  threshold: number | null
  odometer: boolean
}

export type FleetDigestT = {
  overdue: DigestEntryT[]
  within7: DigestEntryT[]
  odometer: OdometerEntryT[]
  stamps: StampT[]
}

export const isEmptyDigest = (digest: FleetDigestT): boolean =>
  digest.overdue.length === 0 && digest.within7.length === 0 && digest.odometer.length === 0

/**
 * Today's digest, decided purely from the loaded histories — no clock, no DB, no send.
 *
 * Only the newest event per (vehicle, type) is ever judged: it is the one carrying the current
 * deadline, and an older row's stale bookkeeping must not resurrect a deadline that has already been
 * renewed. Retired vehicles never enter — their deadlines are history, not a to-do list.
 */
export const buildFleetDigest = (
  histories: readonly VehicleHistoryT[],
  today: DayT,
): FleetDigestT => {
  const digest: FleetDigestT = {
    overdue: [],
    within7: [],
    odometer: [],
    stamps: [],
  }

  for (const { vehicle, events } of histories) {
    if (vehicle.status !== 'ACTIVE') continue

    const latest = latestByType(events)
    const latestOdometer = latestOdometerReading(events)

    for (const type of SCHEDULED_INSPECTION_TYPES) {
      // A type that does not apply is not urgent: without this the mail would report PO TERMINIE on
      // the very row the listing renders as „bezterminowo".
      if (isExempt(vehicle.exemptions, type)) continue

      const row = latest[type]
      if (!row) continue

      const decision = shouldNotify({ row, today, latestOdometer })
      if (!decision.date && !decision.odometer) continue

      if (decision.date && row.nextDueAt) {
        const dueDay = toWarsawDay(row.nextDueAt)
        const entry: DigestEntryT = {
          inspectionId: row.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          type,
          nextDueAt: dueDay,
          daysLeft: daysBetween(today, dueDay),
        }

        if (decision.bucket === OVERDUE) digest.overdue.push(entry)
        else digest.within7.push(entry)
      }

      const target = oilTarget(row)
      if (decision.odometer && target != null && latestOdometer != null) {
        digest.odometer.push({
          inspectionId: row.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          targetOdometer: target,
          latestOdometer,
          kmRemaining: target - latestOdometer,
          kmSinceChange: row.odometer != null ? latestOdometer - row.odometer : null,
        })
      }

      digest.stamps.push({
        inspectionId: row.id,
        threshold: decision.date ? decision.bucket : null,
        odometer: decision.odometer,
      })
    }
  }

  return digest
}
