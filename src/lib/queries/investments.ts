import { unstable_cache } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS, entityTag } from '@/lib/cache/tags'
import { perfStart } from '@/lib/perf'
import {
  fetchReferenceData,
  fetchInvestmentFinancials,
  type InvestmentFinancialsMapT,
} from '@/lib/queries/reference-data'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/components/tables/investments'

export function shapeInvestments(
  investments: InvestmentRefT[],
  financialsRecord: InvestmentFinancialsMapT,
): InvestmentRowT[] {
  return investments.map((inv) => {
    const fin = financialsRecord[String(inv.id)]
    const financials = fin ?? {
      categoryCosts: [],
      totalMaterialCosts: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      totalRabat: 0,
      totalLoss: 0,
      totalSettled: 0,
      materialsNetDiscount: 0,
      settledCategoryCosts: [],
    }
    const totalCosts = financials.totalMaterialCosts + financials.totalLaborCosts
    // Sum of the categorised expense breakdown = total INVESTMENT_EXPENSE.
    // Mirrors the detail page: corrections are uncategorised, so they sit outside
    // this total (and outside the per-category columns), not folded in.
    const totalInvestmentExpense = financials.categoryCosts.reduce((sum, c) => sum + c.total, 0)
    return {
      id: inv.id,
      name: inv.name,
      status: inv.status,
      totalCosts,
      totalMaterialCosts: financials.totalMaterialCosts,
      totalIncome: financials.totalIncome,
      totalLaborCosts: financials.totalLaborCosts,
      totalPayouts: financials.totalPayouts,
      totalInvestmentExpense,
      categoryCosts: financials.categoryCosts,
      balance: calculateBalance(financials),
      margin: calculateMargin(financials),
      address: inv.address,
      phone: inv.phone,
      email: inv.email,
      contactPerson: inv.contactPerson,
      review: inv.review,
      notes: inv.notes,
      hasSheet: inv.hasSheet,
      materialsNetRate: inv.materialsNetRate,
      settlementMode: inv.settlementMode,
    }
  })
}

export async function fetchAllInvestments(): Promise<InvestmentRowT[]> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')
  const [refData, financials] = await Promise.all([
    fetchReferenceData(),
    fetchInvestmentFinancials(),
  ])
  return shapeInvestments(refData.investments, financials)
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
