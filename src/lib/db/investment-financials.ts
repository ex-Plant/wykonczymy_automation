import { financialBucketOf, type FinancialBucketT } from '@/lib/constants/transfers'
import type {
  CategoryBreakdownsT,
  CategoryCostT,
  CategoryTypeSettledRowT,
  InvestmentFinancialsT,
  TypeSettledTotalT,
} from '@/types/investment-financials'

/**
 * Single source of truth for the per-category split — mirrors deriveFinancials by reading
 * the same `financialBucket` column, so settledCategoryCosts reconciles with totalSettled
 * by construction and the "Materiały wliczone w robociznę" buttons sum to the headline.
 */
export function deriveCategoryBreakdowns(rows: CategoryTypeSettledRowT[]): CategoryBreakdownsT {
  const live = new Map<number, number>()
  const settled = new Map<number, number>()
  for (const r of rows) {
    if (financialBucketOf(r.type) !== 'materials') continue
    const bucket = r.settled ? settled : live
    bucket.set(r.categoryId, (bucket.get(r.categoryId) ?? 0) + r.total)
  }
  const toCosts = (m: Map<number, number>): CategoryCostT[] =>
    [...m].map(([categoryId, total]) => ({ categoryId, total }))
  return { categoryCosts: toCosts(live), settledCategoryCosts: toCosts(settled) }
}

const sumRows = (rows: TypeSettledTotalT[], pred: (r: TypeSettledTotalT) => boolean): number =>
  rows.reduce((acc, r) => (pred(r) ? acc + r.total : acc), 0)

const sumBucket = (rows: TypeSettledTotalT[], bucket: FinancialBucketT): number =>
  sumRows(rows, (r) => financialBucketOf(r.type) === bucket)

/** The listing and the detail page both funnel through here, so the bucketing rule
 *  cannot differ between the two views. */
export function deriveFinancials(
  rows: TypeSettledTotalT[],
  categoryCosts: CategoryCostT[] = [],
  settledCategoryCosts: CategoryCostT[] = [],
): InvestmentFinancialsT {
  const isMaterial = (r: TypeSettledTotalT) => financialBucketOf(r.type) === 'materials'
  return {
    categoryCosts,
    // The only bucket that splits on the per-ROW settled flag: settled material has been
    // priced into robocizna, so it leaves materiały/bilans and lowers margin instead.
    totalMaterialCosts: sumRows(rows, (r) => isMaterial(r) && !r.settled),
    totalIncome: sumBucket(rows, 'income'),
    totalLaborCosts: sumBucket(rows, 'laborCosts'),
    totalPayouts: sumBucket(rows, 'payouts'),
    totalRabat: sumBucket(rows, 'discount'),
    totalLoss: sumBucket(rows, 'loss'),
    totalSettled: sumRows(rows, (r) => isMaterial(r) && r.settled),
    settledCategoryCosts,
  }
}
