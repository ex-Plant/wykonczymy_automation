import { daysBetween, toWarsawDay, type DayT } from '@/lib/dates/days'

/**
 * Urgency buckets as day counts, the fleet's encoding (`lib/fleet/thresholds.ts`): „which bucket",
 * „how urgent" and „was it already mailed" all collapse into one comparable smallint, and dedupe is
 * a `<`. `0` reads as EXPIRED — zero days left.
 *
 * Where this deliberately parts company with the fleet: an expired warranty is a bucket for
 * COLOURING and never for mailing. A missed inspection has to be caught up on, so nagging is the
 * point; a lapsed warranty cannot be caught up on, so a mail about it is pure noise.
 */
export const EXPIRED = 0

export const WARRANTY_BUCKETS = [EXPIRED, 7, 30] as const

export type WarrantyBucketT = (typeof WARRANTY_BUCKETS)[number]

/**
 * Which bucket a warranty end date falls into relative to `today`. `null` = nothing to say — either
 * no date recorded, or it is further out than the widest bucket.
 *
 * The last day is still covered: a warranty is good through the date on the receipt.
 */
export const classifyWarranty = (
  warrantyUntil: string | null,
  today: DayT,
): WarrantyBucketT | null => {
  if (!warrantyUntil) return null

  const daysLeft = daysBetween(today, toWarsawDay(warrantyUntil))
  if (daysLeft < 0) return EXPIRED

  return WARRANTY_BUCKETS.find((bucket) => bucket > 0 && daysLeft <= bucket) ?? null
}

/** Days to the end of the warranty; negative once it has lapsed. `null` when no date is recorded. */
export const warrantyDaysLeft = (warrantyUntil: string | null, today: DayT): number | null =>
  warrantyUntil === null ? null : daysBetween(today, toWarsawDay(warrantyUntil))

/** Every bucket mails except the one that cannot be acted on. This is the whole rule. */
export const isMailedBucket = (bucket: WarrantyBucketT): boolean => bucket !== EXPIRED

/** Strictly more urgent — the same bucket is not an escalation and earns no second mail. */
export const isMoreUrgent = (bucket: WarrantyBucketT, than: number | null): boolean =>
  than === null || bucket < than
