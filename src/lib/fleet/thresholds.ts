import { daysBetween, type DayT } from '@/lib/fleet/days'

/**
 * Urgency buckets, encoded as the number of days they cover so the value can be persisted straight
 * into `notifiedThreshold` (smallint). `0` reads as OVERDUE — "zero days left" — which makes the
 * urgency order simply "smaller is more urgent" and the dedupe comparison a `<`.
 */
export const OVERDUE = 0

export const DEADLINE_BUCKETS = [OVERDUE, 1, 7, 30] as const

export type DeadlineBucketT = (typeof DEADLINE_BUCKETS)[number]

/**
 * Which bucket a due date falls into relative to `today` (both Warsaw days, and `today` is a
 * parameter so nothing here reads the clock). `null` = nothing to say yet.
 *
 * The due day itself is due, not overdue: a technical inspection is valid through its last day.
 */
export const classifyDeadline = (nextDueAt: DayT | null, today: DayT): DeadlineBucketT | null => {
  if (!nextDueAt) return null

  const daysLeft = daysBetween(today, nextDueAt)
  if (daysLeft < 0) return OVERDUE

  return DEADLINE_BUCKETS.find((bucket) => bucket > 0 && daysLeft <= bucket) ?? null
}

/** Strictly more urgent — the same bucket is not an escalation, so it earns no second email. */
export const isMoreUrgent = (bucket: DeadlineBucketT, than: number | null): boolean =>
  than === null || bucket < than

/**
 * How close to the oil change's kilometre target counts as due. Unlike the date legs this cannot be
 * polled — the current mileage is unknown between inspections — so it is judged only when a new
 * odometer reading arrives. See src/lib/fleet/should-notify.ts.
 */
export const OIL_ODOMETER_WARN_KM = 1000

/**
 * How far the car may go on one oil change before the module raises an alarm of its own. This is the
 * fallback for the common case where nobody typed a target into „Następna wymiana przy (km)" — with
 * no target there is nothing to count down to, and the oil would age unwatched.
 */
export const OIL_CHANGE_INTERVAL_KM = 10_000

/** `null` (no reading to compare) is not overdue — an unknown distance must never render as alarm. */
export const isOilChangeOverdue = (kmSinceOilChange: number | null): boolean =>
  kmSinceOilChange !== null && kmSinceOilChange > OIL_CHANGE_INTERVAL_KM
