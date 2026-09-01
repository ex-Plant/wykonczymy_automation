import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { asViewPricing, overrideTypeFor } from '@/lib/kosztorys/calc'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type {
  AppendedCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// A katalog kwota lands as a FROZEN amount, never as a coefficient: it is the number the owner
// approved, and a coefficient would re-derive it from the target investment's globals the moment
// the row arrived. A katalog „auto" (`null`) is the opposite instruction — the cennik named no
// stawka — so it lands as NO nadpisanie and `subcontractorPrice` derives it from this
// investment's global współczynnik, exactly as a hand-typed pozycja would.
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
  wToolsOverrideType: catalogueItem.wToolsRate === null ? null : 'amount',
  wToolsOverrideValue: catalogueItem.wToolsRate ?? 0,
  ownToolsOverrideType: catalogueItem.ownToolsRate === null ? null : 'amount',
  ownToolsOverrideValue: catalogueItem.ownToolsRate ?? 0,
  note: null,
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

  // An „auto" plane is skipped rather than checked: there is no stawka yet to take 80% of, and the
  // one the współczynnik will imply is checked in the rozpiska like every other derived row. Same
  // silence the guard already keeps when cena j.m. is 0.
  const warnings = items.flatMap((item) => {
    const problems = (['w_tools', 'own_tools'] as const)
      .filter((plane) => overrideTypeFor(item, plane) !== null)
      // Zero globals: this filter leaves only planes frozen to a kwota, and a kwota never reads a
      // współczynnik — so the guard needs no investment context to reach its verdict.
      .flatMap((plane) => checkSubcontractorPrice(asViewPricing(item), plane) ?? [])
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
