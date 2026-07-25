'use client'

import { usePathname } from 'next/navigation'
import type { InvestmentRefT } from '@/types/reference-data'

// `[id]` is also /kasa/[id] and /pracownicy/[id], so useParams alone would hand a cash-register or
// worker id to the investment select — the path prefix is what makes the segment mean "investment".
const INVESTMENT_PATH = /^\/inwestycje\/(\d+)(\/|$)/

/**
 * The investment id the current URL is scoped to, as the form's string value ('' when there is
 * none). Validated against `investments` because that list is role-filtered — an id the user can't
 * pick must not be seeded into the form.
 */
export function useInvestmentFromUrl(investments: readonly InvestmentRefT[]): string {
  const pathname = usePathname()
  const id = pathname?.match(INVESTMENT_PATH)?.[1]
  if (!id) return ''
  return investments.some((investment) => investment.id === Number(id)) ? id : ''
}
