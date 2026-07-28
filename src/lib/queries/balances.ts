import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import {
  sumAllRegisterBalances,
  sumAllWorkerBalances,
  sumAllInvestmentFinancials,
} from '@/lib/db/sum-transfers'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import { perfStart } from '@/lib/perf'

export type RegisterBalanceMapT = Record<string, number>

export const fetchRegisterBalances = unstable_cache(
  async (): Promise<RegisterBalanceMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const map = await sumAllRegisterBalances(payload)
    const record = Object.fromEntries(map)
    console.log(`[PERF] query.fetchRegisterBalances ${elapsed()}ms (${map.size} registers)`)
    return record
  },
  ['register-balances'],
  { tags: [CACHE_TAGS.transfers] },
)

export type WorkerBalanceMapT = Record<string, number>

export const fetchWorkerBalances = unstable_cache(
  async (): Promise<WorkerBalanceMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const map = await sumAllWorkerBalances(payload)
    const record = Object.fromEntries(map)
    console.log(`[PERF] query.fetchWorkerBalances ${elapsed()}ms (${map.size} workers)`)
    return record
  },
  ['worker-balances'],
  { tags: [CACHE_TAGS.transfers] },
)

export type InvestmentFinancialsMapT = Record<string, InvestmentFinancialsT>

export const fetchInvestmentFinancials = unstable_cache(
  async (): Promise<InvestmentFinancialsMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const map = await sumAllInvestmentFinancials(payload)
    const record: InvestmentFinancialsMapT = {}
    for (const [id, financials] of map) {
      record[String(id)] = financials
    }
    console.log(`[PERF] query.fetchInvestmentFinancials ${elapsed()}ms (${map.size} investments)`)
    return record
  },
  ['investment-financials'],
  // Two tags, not one: the figures are summed from transfers, but the materiały concession and the
  // settlement mode that gates it are columns on `investments`. Tagged on transfers alone, saving a
  // rate left the listing serving the pre-change marża until an unrelated transfer happened to
  // expire it, while the detail page (uncached) already showed the new one.
  { tags: [CACHE_TAGS.transfers, CACHE_TAGS.investments] },
)
