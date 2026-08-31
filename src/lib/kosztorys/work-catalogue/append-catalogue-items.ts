import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysItemT, KosztorysSectionT, ViewPricingT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// The created rows in the nested shape `getKosztorysTree` yields, so the grid can build its rows
// without a refetch — same contract as `AppendedSliceT`, one section instead of many.
export type AppendedCatalogueSliceT = {
  section: KosztorysSectionT & { items: KosztorysItemT[] }
  warnings: string[]
}

// Both stawki land as FROZEN amounts, never as coefficients: the katalog's numbers are the ones the
// owner approved, and a coefficient would re-derive them from the target investment's globals the
// moment the row arrived.
const asItem = (
  catalogueItem: WorkCatalogueItemT,
  sectionId: number,
  displayOrder: number,
): KosztorysItemT => ({
  id: 0,
  sectionId,
  displayOrder,
  description: catalogueItem.description,
  unit: catalogueItem.unit,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: catalogueItem.clientPrice,
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: catalogueItem.wToolsRate,
  ownToolsOverrideType: 'amount',
  ownToolsOverrideValue: catalogueItem.ownToolsRate,
  note: null,
})

// With both planes frozen to amounts the global coefficients are unreachable, so the guard needs no
// investment context to reach its verdict.
const asPricing = (item: KosztorysItemT): ViewPricingT => ({
  ...item,
  globalDiscountActive: false,
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

/**
 * Append cennik pozycje to the END of one sekcja. THE CALLER OWNS THE TRANSACTION.
 *
 * Appending (`MAX(display_order)+1`) rather than inserting at a slot is what lets this write N rows
 * at once: `shiftDisplayOrderFrom` moves the tail by exactly +1, so an insert-at of N rows would
 * silently collide. Each row gets `next + i` — DISTINCT display_orders, because `insertItems` maps
 * RETURNING ids back by `(section_id, display_order)` and degrades to positional order on a tie.
 *
 * The 80% ceiling WARNS and does not block: a katalog price the owner entered on purpose must not be
 * refused by the row it is being copied into, but he still gets told which praca crossed it.
 */
export async function appendCatalogueItems(
  payload: Payload,
  req: PayloadRequest,
  sectionId: number,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<AppendedCatalogueSliceT | undefined> {
  const db = await getDb(payload, req)

  // Owner derived from the sekcja, never from the wire — an item's investment and section FKs can
  // then never disagree.
  const owner = await sectionOwnerAndNextItemOrder(db, sectionId)
  if (!owner) return undefined

  const items = catalogueItems.map((catalogueItem, i) =>
    asItem(catalogueItem, sectionId, owner.nextDisplayOrder + i),
  )

  const warnings = items.flatMap((item) => {
    const problems = (['w_tools', 'own_tools'] as const).flatMap(
      (plane) => checkSubcontractorPrice(asPricing(item), plane) ?? [],
    )
    return problems.map((problem) => `„${item.description}": ${problem}`)
  })

  const newIds = await insertItems(
    db,
    owner.investmentId,
    items.map((item) => ({ sectionId, item })),
  )

  return {
    section: {
      ...owner.section,
      items: items.map((item, i) => ({ ...item, id: newIds[i] })),
    },
    warnings,
  }
}
