export type CategoryCostT = {
  categoryId: number
  total: number
}

export type InvestmentFinancialsT = {
  categoryCosts: CategoryCostT[]
  /** Everything the client is billed for as materiały: `materialsGrossBase + materialsNetBilled`.
   *  Both bilanses read this one figure, so the netto type counts at its netto here. */
  totalMaterialCosts: number
  /** The brutto-billed material sum — the ONLY part the global kosztorys „wszystko netto"
   *  toggle may reduce. Keeping the netto type out of it makes a double cut impossible. */
  materialsGrossBase: number
  /** Σ `netAmount` of the netto expense type: already a netto figure, frozen against the toggle. */
  materialsNetBilled: number
  totalIncome: number
  totalLaborCosts: number
  totalPayouts: number
  totalRabat: number
  totalLoss: number
  totalSettled: number
  settledCategoryCosts: CategoryCostT[]
}

/** One row of the kosztorys „Materiały" split — a per-expense-category cost (`id` = the
 *  category), or the uncategorised remainder (`id` = null). Σ net === totalMaterialCosts.
 *  `net` is a legacy name: on a `gross` row it holds the recorded BRUTTO. `origin` says which
 *  bucket the row came from, because the two are valued differently — a `netBilled` row is
 *  already netto and must never be repriced by the toggle. A category with rows in both
 *  buckets yields two rows, so the toggle can't reach the netto half. */
export type MaterialyBreakdownRowT = {
  id: number | null
  label: string
  net: number
  origin: 'gross' | 'netBilled'
}

export type CategoryTypeSettledRowT = {
  categoryId: number
  type: string
  settled: boolean
  total: number
  netTotal?: number
}

export type CategoryBreakdownsT = {
  /** Billed materiały per category — the netto type counts at its `netAmount` here, so
   *  Σ categoryCosts still reconciles with `totalMaterialCosts`. */
  categoryCosts: CategoryCostT[]
  /** The netto-billed subset of `categoryCosts`, so a consumer can freeze exactly that
   *  part against the global toggle instead of re-deriving it from types. */
  netCategoryCosts: CategoryCostT[]
  settledCategoryCosts: CategoryCostT[]
}

/** Raw per-(type, settled) sum for one investment — the input both code paths feed
 *  into deriveFinancials(). `netTotal` is Σ `net_amount`, non-null only for the type
 *  whose spec row bills at `netAmount`. */
export type TypeSettledTotalT = {
  type: string
  settled: boolean
  total: number
  netTotal?: number
}
