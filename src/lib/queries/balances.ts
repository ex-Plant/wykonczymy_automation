import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysClientTotals } from '@/lib/db/kosztorys-client-totals'
import { selectKosztorysSubcontractorDue } from '@/lib/db/kosztorys-subcontractor-due'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/margin-v2'
import {
  sumAllRegisterBalances,
  sumAllWorkerBalances,
  sumAllInvestmentFinancials,
} from '@/lib/db/sum-transfers'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
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
  // Versioned key — see the note on `reference-data-v2`. Bumped when `InvestmentFinancialsT` gained
  // `netCategoryCosts`: an entry written before that lacks the array, and a reader dereferencing it
  // throws rather than merely showing an old number.
  ['investment-financials-v2'],
  // Two tags, not one: the figures are summed from transfers, but the materiały concession and the
  // settlement mode that gates it are columns on `investments`. Tagged on transfers alone, saving a
  // rate left the listing serving the pre-change marża until an unrelated transfer happened to
  // expire it, while the detail page (uncached) already showed the new one.
  { tags: [CACHE_TAGS.transfers, CACHE_TAGS.investments] },
)

export type KosztorysClientTotalsMapT = Record<string, KosztorysClientTotalsT>

// Every tag whose collection can move these figures. `investments` is load-bearing, not padding: the
// global rabat is a column there, so a rabat change moves the pair without touching a single
// kosztorys row. Sections carry no figure of their own, but deleting one takes its items with it.
//
// Accepted cost (owner): every debounced autosave in the editor expires this entry for the whole
// listing, so the next visit to /inwestycje pays a full recompute. That is the price of the listing
// never showing a stale kosztorys figure — and the recompute is one aggregate returning one row per
// investment, not a re-read of the kosztoryses themselves.
export const KOSZTORYS_CLIENT_TOTALS_TAGS = [
  CACHE_TAGS.kosztorysItems,
  CACHE_TAGS.kosztorysSections,
  CACHE_TAGS.kosztorysStages,
  CACHE_TAGS.stageProgress,
  CACHE_TAGS.investments,
]

export const fetchKosztorysClientTotals = unstable_cache(
  async (): Promise<KosztorysClientTotalsMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    const rows = await selectKosztorysClientTotals(db)
    const record: KosztorysClientTotalsMapT = {}
    for (const { investmentId, ...totals } of rows) {
      record[String(investmentId)] = totals
    }
    console.log(
      `[PERF] query.fetchKosztorysClientTotals ${elapsed()}ms (${rows.length} investments)`,
    )
    return record
  },
  ['kosztorys-client-totals-v1'],
  { tags: KOSZTORYS_CLIENT_TOTALS_TAGS },
)

export type KosztorysSubcontractorDueMapT = Record<string, SubcontractorSettlementT>

// Same tag set as the client pair above, deliberately not a narrower one: every table this fold
// reads (items, stages, progress, and the investment's coefficients) is already in it, and a second
// list would be a second thing to keep in step.
export const fetchKosztorysSubcontractorDue = unstable_cache(
  async (): Promise<KosztorysSubcontractorDueMapT> => {
    const elapsed = perfStart()
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    const rows = await selectKosztorysSubcontractorDue(db)
    const record: KosztorysSubcontractorDueMapT = {}
    for (const { investmentId, ...settlement } of rows) {
      record[String(investmentId)] = settlement
    }
    console.log(
      `[PERF] query.fetchKosztorysSubcontractorDue ${elapsed()}ms (${rows.length} investments)`,
    )
    return record
  },
  ['kosztorys-subcontractor-due-v1'],
  { tags: KOSZTORYS_CLIENT_TOTALS_TAGS },
)
