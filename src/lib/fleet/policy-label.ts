import type { InspectionHistoryEntryT } from '@/types/fleet'

/**
 * „Ubezpieczyciel · nr polisy" for the polisa currently in force — the first entry, since the history
 * arrives newest-first out of `historyOfType`.
 *
 * Either half may be missing and the label still says something: the przyczepa carries a policy
 * number with no insurer recorded, so joining unconditionally would print a leading separator.
 */
export const currentPolicyLabel = (
  insuranceHistory: readonly InspectionHistoryEntryT[],
): string => {
  const current = insuranceHistory[0]
  if (!current) return ''

  return [current.insurer, current.policyNumber].filter(Boolean).join(' · ')
}
