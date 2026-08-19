import { isMonday, toWarsawDay, daysBetween, type DayT } from '@/lib/fleet/days'
import { latestByType, latestOdometerReading } from '@/lib/fleet/deadlines'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { findMissingInspections, type MissingInspectionT } from '@/lib/fleet/missing-data'
import { oilTarget, shouldNotify } from '@/lib/fleet/should-notify'
import { OVERDUE } from '@/lib/fleet/thresholds'
import type { VehicleHistoryT } from '@/lib/fleet/types'

export type DigestEntryT = {
  inspectionId: number
  registration: string
  type: InspectionTypeT
  nextDueAt: DayT
  daysLeft: number
}

export type OdometerEntryT = {
  inspectionId: number
  registration: string
  /** The reading the oil is due at — the typed target, or the interval from the last change. */
  targetOdometer: number
  latestOdometer: number
  /** Negative once the target is behind us. */
  kmRemaining: number
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
  within30: DigestEntryT[]
  odometer: OdometerEntryT[]
  missing: MissingInspectionT[]
  stamps: StampT[]
}

export const isEmptyDigest = (digest: FleetDigestT): boolean =>
  digest.overdue.length === 0 &&
  digest.within7.length === 0 &&
  digest.within30.length === 0 &&
  digest.odometer.length === 0 &&
  digest.missing.length === 0

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
    within30: [],
    odometer: [],
    missing: isMonday(today) ? findMissingInspections(histories) : [],
    stamps: [],
  }

  for (const { vehicle, events } of histories) {
    if (vehicle.status !== 'ACTIVE') continue

    const latest = latestByType(events)
    const latestOdometer = latestOdometerReading(events)

    for (const type of INSPECTION_TYPES) {
      const row = latest[type]
      if (!row) continue

      const decision = shouldNotify({ row, today, latestOdometer })
      if (!decision.date && !decision.odometer) continue

      if (decision.date && row.nextDueAt) {
        const dueDay = toWarsawDay(row.nextDueAt)
        const entry: DigestEntryT = {
          inspectionId: row.id,
          registration: vehicle.registration,
          type,
          nextDueAt: dueDay,
          daysLeft: daysBetween(today, dueDay),
        }

        if (decision.bucket === OVERDUE) digest.overdue.push(entry)
        else if (decision.bucket === 30) digest.within30.push(entry)
        else digest.within7.push(entry)
      }

      const target = oilTarget(row)
      if (decision.odometer && target != null && latestOdometer != null) {
        digest.odometer.push({
          inspectionId: row.id,
          registration: vehicle.registration,
          targetOdometer: target,
          latestOdometer,
          kmRemaining: target - latestOdometer,
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
