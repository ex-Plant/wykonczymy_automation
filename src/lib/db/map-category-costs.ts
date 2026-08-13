import type {
  CategoryCostT,
  FinancialFieldT,
  InvestmentFinancialsT,
  MaterialyBreakdownRowT,
} from '@/types/investment-financials'
import { formatPLN } from '@/lib/utils/format-currency'

// Material spend not attributed to any expense category — in practice legacy corrections
// entered before the category became required. It counts toward totalMaterialCosts, so it
// MUST surface as its own row wherever the category split is shown, or the sum drifts below
// the listing's bilans.
const KOREKTA_LABEL = 'Korekta (bez kategorii)'

// The tile labels the investment header matches on to pick a figure out of the field list — exported
// so the consumer reads the same string this builder writes.
export const LABOR_LABEL = 'Robocizna netto'
export const RABAT_LABEL = 'Rabat netto'
export const INCOME_LABEL = 'Wpłaty'
export const MATERIALS_DISCOUNT_LABEL = 'Obniżka materiałów'
export const LOSS_LABEL = 'Strata'

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
 *  it keeps the Σ invariant intact — the split only decides which rows the toggle may reprice.
 *
 *  Rows are grouped by origin, not interleaved per category: every brutto row first, then the frozen
 *  netto ones as a block. The netto rows are the exception the reduction can't touch, so they read as
 *  a set — interleaved they look like a per-category sub-row and invite summing the pair. */
export function buildMaterialyBreakdown(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
  netCategoryCosts: CategoryCostT[] = [],
): MaterialyBreakdownRowT[] {
  const grossRows: MaterialyBreakdownRowT[] = expenseCategories.map((cat) => ({
    id: cat.id,
    label: cat.name,
    net:
      costForCategory(financials.categoryCosts, cat.id) - costForCategory(netCategoryCosts, cat.id),
    origin: 'gross',
  }))
  const uncategorised = uncategorisedRemainder(financials)
  if (uncategorised !== 0)
    grossRows.push({ id: null, label: KOREKTA_LABEL, net: uncategorised, origin: 'gross' })

  const netRows: MaterialyBreakdownRowT[] = expenseCategories
    .map((cat) => ({ cat, netBilled: costForCategory(netCategoryCosts, cat.id) }))
    .filter(({ netBilled }) => netBilled !== 0)
    .map(({ cat, netBilled }) => ({
      id: cat.id,
      label: `${cat.name} netto`,
      net: netBilled,
      origin: 'netBilled' as const,
    }))

  return [...grossRows, ...netRows]
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

/** Build the shared financial header fields (category costs + totals).
 *
 *  Category tiles stay on the RAW receipt plane while the listing prices the same labels at what the
 *  investor is billed — so one label carries two numbers across the two surfaces. Deliberate (EX-670,
 *  cancelled): no total drifts, because the whole concession sits in the `MATERIALS_DISCOUNT_LABEL`
 *  tile and the header's bilans is the Σ of these tiles. Moving the tiles onto the billed plane is
 *  only correct together with DROPPING that tile — Σ billed categories === Σ raw − materialsNetDiscount
 *  — and it would cost the toggle that lets the owner switch the concession off. Not worth it: the
 *  consumer, `FinancialStats`, renders only under `version === 'v1'`, which is legacy kept for
 *  side-by-side testing. `raporty` also calls this with no rate available at all. */
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: { id: number; name: string }[],
  { hideZeroCosts = false }: BuildOptionsT = {},
): FinancialFieldT[] {
  const {
    categoryCosts,
    totalIncome,
    totalLaborCosts,
    totalRabat,
    materialsNetDiscount,
    totalLoss,
  } = financials
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
      label: LABOR_LABEL,
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: INCOME_LABEL, value: formatPLN(totalIncome), amount: totalIncome },
    ...(totalRabat !== 0
      ? [{ label: RABAT_LABEL, value: formatPLN(totalRabat), amount: totalRabat }]
      : []),
    // The header's bilans is the SUM of these tiles, so every term of `calculateBalance` owes one or
    // the two readings drift apart. Rabat has a tile for exactly this reason; the materiały
    // concession raises the balance the same way and needs the same seat.
    ...(materialsNetDiscount !== 0
      ? [
          {
            label: MATERIALS_DISCOUNT_LABEL,
            value: formatPLN(materialsNetDiscount),
            amount: materialsNetDiscount,
          },
        ]
      : []),
    ...(totalLoss !== 0
      ? [{ label: LOSS_LABEL, value: formatPLN(totalLoss), amount: totalLoss }]
      : []),
  ]
}

/** The same per-category split as `buildSettledFields`, but as numeric breakdown rows for the
 *  summary panel's table. Kept separate from `buildMaterialyBreakdown` because settled material is
 *  never billed to the investor: it carries no netto bucket, takes no reduction, and its Σ must NOT
 *  join `totalMaterialCosts`. A category with no settled spend is dropped — a zero row here would
 *  read as "the company absorbed nothing in this bucket", which is the same thing as absent. */
export function buildSettledBreakdown(
  settledCategoryCosts: CategoryCostT[],
  expenseCategories: { id: number; name: string }[],
): MaterialyBreakdownRowT[] {
  return expenseCategories
    .map((cat) => ({ cat, total: costForCategory(settledCategoryCosts, cat.id) }))
    .filter(({ total }) => total !== 0)
    .map(({ cat, total }) => ({
      id: cat.id,
      label: cat.name,
      net: total,
      origin: 'gross' as const,
    }))
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
