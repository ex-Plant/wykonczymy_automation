import type {
  CategoryCostT,
  InvestmentFinancialsT,
  MaterialyBreakdownRowT,
} from '@/types/investment-financials'
import type { FinancialFieldT } from '@/types/export'
import { formatPLN } from '@/lib/utils/format-currency'

// Material spend not attributed to any expense category — in practice legacy corrections
// entered before the category became required. It counts toward totalMaterialCosts, so it
// MUST surface as its own row wherever the category split is shown, or the sum drifts below
// the listing's bilans.
const KOREKTA_LABEL = 'Korekta (bez kategorii)'

/** Amount booked to a given expense category, 0 when that category has no rows. */
export function costForCategory(categoryCosts: CategoryCostT[], categoryId: number): number {
  return categoryCosts.find((c) => c.categoryId === categoryId)?.total ?? 0
}

function uncategorisedRemainder(financials: InvestmentFinancialsT): number {
  const categorised = financials.categoryCosts.reduce((sum, c) => sum + c.total, 0)
  return financials.totalMaterialCosts - categorised
}

/** The kosztorys „Materiały" split — one row per expense category (v1 mirror parity:
 *  Materiały budowlane / wykończeniowe / Pozostałe koszty), plus the uncategorised remainder,
 *  so Σ rows === totalMaterialCosts and the podsumowanie reconciles with the investment page's
 *  materiały byte-for-byte.
 *
 *  A category billed partly at netto splits into two rows: the brutto remainder and a frozen
 *  „… netto" row. `netCategoryCosts` is a subset of `financials.categoryCosts`, so subtracting
 *  it keeps the Σ invariant intact — the split only decides which rows the toggle may reprice. */
export function buildMaterialyBreakdown(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
  netCategoryCosts: CategoryCostT[] = [],
): MaterialyBreakdownRowT[] {
  const rows: MaterialyBreakdownRowT[] = expenseCategories.flatMap((cat) => {
    const billed = costForCategory(financials.categoryCosts, cat.id)
    const netBilled = costForCategory(netCategoryCosts, cat.id)
    const grossRow: MaterialyBreakdownRowT = {
      id: cat.id,
      label: cat.name,
      net: billed - netBilled,
      origin: 'gross',
    }
    if (netBilled === 0) return [grossRow]
    return [
      grossRow,
      { id: cat.id, label: `${cat.name} netto`, net: netBilled, origin: 'netBilled' as const },
    ]
  })
  const uncategorised = uncategorisedRemainder(financials)
  if (uncategorised !== 0)
    rows.push({ id: null, label: KOREKTA_LABEL, net: uncategorised, origin: 'gross' })
  return rows
}

/** Map expense categories to header fields. By default ALL of them, showing 0 for a category with
 *  no transactions — a zero tile still says "this cost bucket exists and is empty", which the export
 *  header and the v1 reading both rely on for a stable column set. */
function mapCategoryCostsToFields(
  categoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
  hideZeroCosts: boolean,
): FinancialFieldT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(categoryCosts, cat.id) }))
    .filter(({ total }) => !hideZeroCosts || total !== 0)
    .map(({ cat, total }) => ({ label: cat.name, value: formatPLN(total), amount: -total }))
}

type BuildOptionsT = {
  /** Drop expense categories with no spend instead of rendering them at 0. Scopes to the cost
   *  tiles only — Robocizna and Wpłaty are the figures under comparison and must stay visible
   *  even at zero, or the block would silently shrink to nothing on an empty investment. */
  hideZeroCosts?: boolean
}

/** Build the shared financial header fields (category costs + totals). */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
  { hideZeroCosts = false }: BuildOptionsT = {},
): FinancialFieldT[] {
  const { categoryCosts, totalIncome, totalLaborCosts, totalRabat } = financials
  const uncategorised = uncategorisedRemainder(financials)

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories, hideZeroCosts),
    ...(uncategorised !== 0
      ? [
          {
            label: KOREKTA_LABEL,
            value: formatPLN(uncategorised),
            amount: -uncategorised,
          },
        ]
      : []),
    {
      label: 'Robocizna',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
    ...(totalRabat !== 0
      ? [{ label: 'Rabat', value: formatPLN(totalRabat), amount: totalRabat }]
      : []),
  ]
}

/** Build labelled fields for settled internal material, split per expense category.
 *  Positive amounts (display only) — these live OUTSIDE the bilans toggle sum. */
export function buildSettledFields(
  settledCategoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): FinancialFieldT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(settledCategoryCosts, cat.id) }))
    .filter(({ total }) => total !== 0)
    .map(({ cat, total }) => ({ label: cat.name, value: formatPLN(total), amount: total }))
}
