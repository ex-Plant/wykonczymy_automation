/**
 * The types that carry a deadline — every one of them answers "when is it next due". Read by the
 * listing's deadline columns, the reminder sweep and the weekly missing-inspections report, which all
 * used to read INSPECTION_TYPES back when the two lists were the same thing.
 */
export const SCHEDULED_INSPECTION_TYPES = [
  'TECHNICAL',
  'INSURANCE',
  'OIL_CHANGE',
  'WARRANTY',
  'TYRES',
] as const

/**
 * Everything a vehicle's history can hold. SERVICE is the ad-hoc repair — a visit to the mechanic
 * with no schedule behind it, as opposed to TECHNICAL (the yearly mandatory przegląd okresowy) and
 * WARRANTY (a service performed while the warranty still runs). Derived from the scheduled list so
 * the two can never drift apart.
 */
export const INSPECTION_TYPES = [...SCHEDULED_INSPECTION_TYPES, 'SERVICE'] as const

export type ScheduledInspectionTypeT = (typeof SCHEDULED_INSPECTION_TYPES)[number]

export type InspectionTypeT = (typeof INSPECTION_TYPES)[number]

export const INSPECTION_TYPE_LABELS: Record<InspectionTypeT, { en: string; pl: string }> = {
  TECHNICAL: { en: 'Technical inspection', pl: 'Przegląd techniczny' },
  INSURANCE: { en: 'Insurance', pl: 'OC' },
  OIL_CHANGE: { en: 'Oil change', pl: 'Wymiana oleju' },
  WARRANTY: { en: 'Warranty inspection', pl: 'Przegląd gwarancyjny' },
  TYRES: { en: 'Tyre change', pl: 'Wymiana opon' },
  SERVICE: { en: 'Service', pl: 'Serwis' },
}

/**
 * Months to add to `performedAt` when prefilling the next due date.
 *
 * `null` for TYRES and SERVICE is a documented member of the type, not a gap: the real next date is
 * printed on the document (badanie techniczne, polisa OC), so every value here is a *suggestion* the
 * human overwrites — tyres have no interval to suggest, and an ad-hoc service has no next date at
 * all. The form reads the `null` to decide not to prefill; it must never fall back to a default, or a
 * two-year warranty would silently be wrong.
 */
export const INSPECTION_INTERVAL_MONTHS: Record<InspectionTypeT, number | null> = {
  TECHNICAL: 12,
  INSURANCE: 12,
  OIL_CHANGE: 12,
  WARRANTY: 24,
  TYRES: null,
  SERVICE: null,
}

/**
 * Build a record keyed by every inspection type. Callers used `Object.fromEntries(...) as Record<…>`
 * — the cast is what this exists to remove.
 */
export const byInspectionType = <T>(valueOf: (type: InspectionTypeT) => T) =>
  Object.fromEntries(INSPECTION_TYPES.map((type) => [type, valueOf(type)])) as Record<
    InspectionTypeT,
    T
  >
