import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import {
  sumPayoutsByWorkerForInvestment,
  getPayoutTransactionsForInvestment,
  getDepositTransactions,
  getDepositTransactionsForInvestment,
} from '@/lib/db/sum-transfers'
import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchMediaByIds } from '@/lib/queries/media'
import { fetchExpenseCategories } from '@/lib/queries/reference-data'
import { extractInvoiceIds } from '@/lib/queries/transfer-mapping'
import { billedAmountFor, EXPENSES_TAB_TYPES } from '@/lib/constants/transfers'
import type {
  PayoutByWorkerT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

// Realized PAYOUTs for one investment, grouped per worker (null-worker bucket kept). Cached under
// CACHE_TAGS.transfers alone — names are joined at the page from reference data, so no users tag is
// needed here; recalculate-balances fires revalidateTag(transfers) on every transfer mutation.
export async function fetchPayoutsByWorkerForInvestment(
  investmentId: number,
): Promise<PayoutByWorkerT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return sumPayoutsByWorkerForInvestment(payload, investmentId)
    },
    ['payouts-by-worker', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

// Same cache contract as the per-worker sum above — transfers tag, worker names joined at the page.
export async function fetchPayoutTransactionsForInvestment(
  investmentId: number,
): Promise<PayoutTransactionRowT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return getPayoutTransactionsForInvestment(payload, investmentId)
    },
    ['payout-transactions', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

// Same cache contract as the payout-transactions fetch — transfers tag, no PII to join.
//
// Deliberately kept as an investment-only entry point: the unauthenticated share read reaches this
// fetcher, so it must expose no filter parameter a caller could widen. Filtered reads go through
// `fetchFilteredDepositTransactions` instead.
export async function fetchDepositTransactionsForInvestment(
  investmentId: number,
): Promise<DepositTransactionRowT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return getDepositTransactionsForInvestment(payload, investmentId)
    },
    ['deposit-transactions', String(investmentId)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

// Deliberately a distinct cache-key prefix from the investment-only fetch above — a filtered result
// cached under an investment-keyed entry would poison `kosztorys_v2` and the share route. The caller
// owns the investment scope; only `INVESTOR_DEPOSIT` and `cancelled IS NOT TRUE` are fixed in SQL.
export async function fetchFilteredDepositTransactions(
  where: Where,
): Promise<DepositTransactionRowT[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config })
      return getDepositTransactions(payload, where)
    },
    ['deposit-transactions-filtered', JSON.stringify(where)],
    { tags: [CACHE_TAGS.transfers] },
  )()
}

/**
 * The individual materiały rows for the Podsumowanie's wydatki list — this investment's
 * INVESTMENT_EXPENSE + INVESTMENT_EXPENSE_NET + CORRECTION, both settled states, so the list can
 * split them into its three tabs (`partitionWydatkiRows` owns the rule and the labels).
 *
 * Shared by the owner's editor page and the unauthenticated client share read, which is why the
 * category-name and invoice joins live here rather than at either page: the two surfaces must label a
 * row — and agree on which rows have a downloadable invoice — identically. Only names are joined;
 * `fetchReferenceData` would drag along company-wide PII that has no business on the share path.
 * `limit: 0` = all rows.
 */
export async function fetchMaterialTransactionsForInvestment(
  investmentId: number,
): Promise<MaterialTransactionRowT[]> {
  const [{ docs }, expenseCategories] = await Promise.all([
    findTransfersRaw({
      where: {
        investment: { equals: investmentId },
        type: { in: [...EXPENSES_TAB_TYPES] },
        cancelled: { not_equals: true },
      },
      page: 1,
      limit: 0,
      sort: '-date',
    }),
    fetchExpenseCategories(),
  ])
  const nameById = new Map(expenseCategories.map((category) => [category.id, category.name]))
  const mediaById = await fetchMediaByIds(extractInvoiceIds(docs))

  // depth: 0 → `expenseCategory` and `invoice` are raw ids (`expenseCategory` null for a legacy
  // uncategorised row / a CORRECTION).
  return docs.map((doc) => {
    const media = typeof doc.invoice === 'number' ? mediaById.get(doc.invoice) : undefined
    return {
      id: Number(doc.id),
      date: String(doc.date),
      type: doc.type,
      amount: Number(doc.amount),
      billed: billedAmountFor(
        doc.type,
        Number(doc.amount),
        doc.netAmount == null ? null : Number(doc.netAmount),
      ),
      description: doc.description != null ? String(doc.description) : null,
      settled: doc.settled === true,
      label:
        doc.expenseCategory != null
          ? (nameById.get(Number(doc.expenseCategory)) ?? 'Nieznana kategoria')
          : doc.type === 'CORRECTION'
            ? 'Korekta'
            : 'Bez kategorii',
      invoiceUrl: media?.url ?? null,
      invoiceFilename: media?.filename ?? null,
      invoiceMimeType: media?.mimeType ?? null,
      invoiceNote: doc.invoiceNote != null ? String(doc.invoiceNote) : null,
    }
  })
}
