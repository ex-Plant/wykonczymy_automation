export const INSPECTION_TYPES = [
  'TECHNICAL',
  'INSURANCE',
  'OIL_CHANGE',
  'WARRANTY',
  'TYRES',
] as const

export type InspectionTypeT = (typeof INSPECTION_TYPES)[number]

export const INSPECTION_TYPE_LABELS: Record<InspectionTypeT, { en: string; pl: string }> = {
  TECHNICAL: { en: 'Technical inspection', pl: 'Przegląd techniczny' },
  INSURANCE: { en: 'Insurance', pl: 'OC' },
  OIL_CHANGE: { en: 'Oil change', pl: 'Wymiana oleju' },
  WARRANTY: { en: 'Warranty inspection', pl: 'Przegląd gwarancyjny' },
  TYRES: { en: 'Tyre change', pl: 'Wymiana opon' },
}

/**
 * Months to add to `performedAt` when prefilling the next due date.
 *
 * `null` for TYRES is a documented member of the type, not a gap: the real next date is printed on
 * the document (badanie techniczne, polisa OC), so every value here is a *suggestion* the human
 * overwrites — and tyres have no interval to suggest at all. The form reads the `null` to decide not
 * to prefill; it must never fall back to a default, or a two-year warranty would silently be wrong.
 */
export const INSPECTION_INTERVAL_MONTHS: Record<InspectionTypeT, number | null> = {
  TECHNICAL: 12,
  INSURANCE: 12,
  OIL_CHANGE: 12,
  WARRANTY: 24,
  TYRES: null,
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
