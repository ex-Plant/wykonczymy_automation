/**
 * The types that carry a deadline — every one of them answers "when is it next due". SERVICE and
 * ODOMETER are the odd ones out: an ad-hoc repair has nothing to count down to and a meter reading is
 * not work at all, so neither belongs to any deadline surface.
 */
export const SCHEDULED_INSPECTION_TYPES = [
  'TECHNICAL',
  'INSURANCE',
  'OIL_CHANGE',
  'WARRANTY',
  'TYRES',
] as const

/**
 * Everything somebody actually performs. SERVICE is the ad-hoc repair — a visit to the mechanic with
 * no schedule behind it, as opposed to TECHNICAL (the yearly mandatory przegląd okresowy) and
 * WARRANTY (a service performed while the warranty still runs).
 *
 * Two surfaces want exactly this list, for the same reason: a „do wymiany" mark can only be put on
 * work somebody does, and only work somebody does has a price. A reading is neither — it cannot be
 * needed, only taken, and nobody is billed for it.
 */
export const PERFORMED_INSPECTION_TYPES = [...SCHEDULED_INSPECTION_TYPES, 'SERVICE'] as const

/**
 * Everything a vehicle's history can hold. ODOMETER records nothing but the mileage on a given day —
 * the way to answer „ile ma teraz" without inventing an inspection that never happened. Derived from
 * the performed list, which is derived from the scheduled one, so a new type is added in one place
 * and the three can never drift apart.
 */
export const INSPECTION_TYPES = [...PERFORMED_INSPECTION_TYPES, 'ODOMETER'] as const

export type ScheduledInspectionTypeT = (typeof SCHEDULED_INSPECTION_TYPES)[number]

export type PerformedInspectionTypeT = (typeof PERFORMED_INSPECTION_TYPES)[number]

export type InspectionTypeT = (typeof INSPECTION_TYPES)[number]

export const INSPECTION_TYPE_LABELS: Record<InspectionTypeT, { en: string; pl: string }> = {
  TECHNICAL: { en: 'Technical inspection', pl: 'Przegląd techniczny' },
  INSURANCE: { en: 'Insurance', pl: 'OC' },
  OIL_CHANGE: { en: 'Oil change', pl: 'Wymiana oleju' },
  WARRANTY: { en: 'Warranty inspection', pl: 'Przegląd gwarancyjny' },
  TYRES: { en: 'Tyre change', pl: 'Wymiana opon' },
  SERVICE: { en: 'Service', pl: 'Serwis' },
  ODOMETER: { en: 'Odometer reading', pl: 'Odczyt licznika' },
}

/**
 * Months to add to `performedAt` when prefilling the next due date.
 *
 * `null` for TYRES, SERVICE and ODOMETER is a documented member of the type, not a gap: the real next date is
 * printed on the document (badanie techniczne, polisa OC), so every value here is a *suggestion* the
 * human overwrites — tyres have no interval to suggest, and an ad-hoc service has no next date at
 * all. The form reads the `null` to decide not to prefill; it must never fall back to a default, or a
 * two-year warranty would silently be wrong. A reading has no next date by definition.
 */
export const INSPECTION_INTERVAL_MONTHS: Record<InspectionTypeT, number | null> = {
  TECHNICAL: 12,
  INSURANCE: 12,
  OIL_CHANGE: 12,
  WARRANTY: 24,
  TYRES: null,
  SERVICE: null,
  ODOMETER: null,
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
