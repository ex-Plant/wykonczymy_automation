import { unstable_cache } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import {
  fetchInvestmentFinancials,
  fetchKosztorysClientTotals,
  fetchKosztorysSubcontractorDue,
} from '@/lib/queries/balances'
import { shapeInvestments } from '@/lib/queries/shape-investments'
import { perfStart } from '@/lib/perf'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import type { InvestmentRowT } from '@/types/table-rows'

export async function fetchAllInvestments(): Promise<InvestmentRowT[]> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')
  const [refData, financials, kosztorysTotals, subcontractorDue] = await Promise.all([
    fetchReferenceData(),
    fetchInvestmentFinancials(),
    fetchKosztorysClientTotals(),
    fetchKosztorysSubcontractorDue(),
  ])
  return shapeInvestments(refData.investments, financials, kosztorysTotals, subcontractorDue)
}

// The single home for the id-validity rule so nothing re-inlines the check and drifts from it.
// Split from parseInvestmentId because a parallel-route slot can't use the notFound() form — a slot
// that 404s takes the whole shell with it, when all it wants is to render nothing.
export function isInvestmentId(id: string): boolean {
  const investmentId = Number(id)
  return Number.isFinite(investmentId) && investmentId > 0
}

// Parse a route id to a positive investment id, notFound() on anything else — for pages that need the
// number before the guard (to fire a fetch concurrently).
export function parseInvestmentId(id: string): number {
  if (!isInvestmentId(id)) notFound()
  return Number(id)
}

// Shared page guard: parse the route id, require a management session, and load the investment —
// bouncing to notFound() on a bad/missing id and to the login page on a failed auth. Returns the
// investment (non-null past this point) plus the numeric id the page needs. Pages that already hold
// the investment from another fetch (e.g. the detail page's refData) don't use this — it would double
// the load.
export async function requireInvestmentOr404(id: string) {
  const investmentId = parseInvestmentId(id)

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const investment = await getInvestment(id)
  if (!investment) notFound()

  return { investmentId, investment, user: session.user }
}

// Name only, for the top-bar crumb. Reads it off the reference data instead of issuing its own
// query: the layout nav already pulls that list on every management route and it is request-deduped,
// so the name costs nothing here — where a dedicated read was a third trip to the same row, and one
// its own `investments` tag re-paid after every settings write (EX-608).
// The role gate is what keeps it free: without a management session there is no warm list to read,
// and the crumb only ever renders over routes that already require one.
// Reads the name off the already-warm reference data instead of querying: `fetchReferenceData` is
// request-deduped and every management session loads it in `Navigation`, so a dedicated cached read
// only added a third round trip for the same row — and one that went cold on every settings write.
// The role gate is load-bearing, not decorative: without it a non-management session would pull the
// company-wide reference dataset just to render a crumb (EX-608).
export async function getInvestmentName(id: string): Promise<string | null> {
  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return null

  const { investments } = await fetchReferenceData()
  return investments.find((investment) => String(investment.id) === id)?.name ?? null
}

export async function getInvestment(id: string) {
  return unstable_cache(
    async () => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      try {
        const investment = await payload.findByID({
          collection: 'investments',
          id,
          overrideAccess: true,
        })
        console.log(`[PERF] query.getInvestment(${id}) ${elapsed()}ms`)
        return investment ?? null
      } catch {
        return null
      }
    },
    ['investment', id],
    { tags: [CACHE_TAGS.investments, entityTag('investment', id)] },
  )()
}
