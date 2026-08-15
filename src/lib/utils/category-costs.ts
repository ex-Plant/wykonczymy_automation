import type { CategoryCostT } from '@/types/investment-financials'

/** Amount booked to a given expense category, 0 when that category has no rows. */
export function costForCategory(categoryCosts: CategoryCostT[], categoryId: number): number {
  return categoryCosts.find((c) => c.categoryId === categoryId)?.total ?? 0
}
