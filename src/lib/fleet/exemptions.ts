import {
  SCHEDULED_INSPECTION_TYPES,
  type ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'

/**
 * The scheduled types a car will never have — „bezterminowo" in the owner's sheet, where the
 * przyczepa's przegląd cell says exactly that.
 *
 * Distinct from `flags` on purpose, despite both being jsonb on the same row: a flag is a mark that
 * clears itself once the work is recorded, an exemption is a permanent property of the vehicle that
 * nothing in the history can answer.
 *
 * Parsed defensively for the same reason as `parseVehicleFlags`: the column holds whatever was last
 * written, including `null` from every vehicle that predates the feature. Unknown and non-scheduled
 * values are dropped rather than trusted — an exemption on a type the UI cannot show would be
 * impossible to untick.
 */
export const parseVehicleExemptions = (raw: unknown): ScheduledInspectionTypeT[] => {
  if (!Array.isArray(raw)) return []

  // Filtering the domain list rather than the input also dedupes and fixes the order in one pass.
  return SCHEDULED_INSPECTION_TYPES.filter((type) => raw.includes(type))
}

export const isExempt = (exemptions: readonly ScheduledInspectionTypeT[], type: string): boolean =>
  exemptions.some((exempt) => exempt === type)
