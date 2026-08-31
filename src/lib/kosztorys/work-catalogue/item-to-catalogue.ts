import { subcontractorPrice } from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/seed-from-preset'
import type { CatalogueSeedItemT, CatalogueSourceItemT } from '@/lib/kosztorys/work-catalogue/types'

// `subcontractorPrice` reads a whole row; the fields it never touches on this path (quantities,
// rabat, notatka) are supplied at their neutral values so the two planes can be asked the same
// question they answer in the grid.
const asPricing = (source: CatalogueSourceItemT): ViewPricingT => ({
  id: 0,
  sectionId: 0,
  displayOrder: 0,
  description: source.description,
  unit: source.unit,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: source.clientPrice,
  wToolsOverrideType: source.wToolsOverrideType,
  wToolsOverrideValue: source.wToolsOverrideValue,
  ownToolsOverrideType: source.ownToolsOverrideType,
  ownToolsOverrideValue: source.ownToolsOverrideValue,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: source.wToolsCoeff,
  globalOwnToolsCoeff: source.ownToolsCoeff,
})

/**
 * The cennik row a praca from the rozpiska implies.
 *
 * Both stawki are the EFFECTIVE ones — a pozycja that overrides nothing freezes what the
 * inwestycja's globals make of its cena, because that is the number the owner is looking at when he
 * decides the praca is worth saving. Cena is the pre-rabat `clientPrice`: a rabat is a concession on
 * one offer, never part of the cennik.
 */
export function toCatalogueCandidate(source: CatalogueSourceItemT): CatalogueSeedItemT {
  const pricing = asPricing(source)
  const description = source.description.trim()
  const unit = source.unit.trim()
  const category = stripSectionOrdinal(source.sectionName)
  return {
    description,
    category: category || null,
    unit,
    clientPrice: source.clientPrice,
    wToolsRate: subcontractorPrice(pricing, 'w_tools'),
    ownToolsRate: subcontractorPrice(pricing, 'own_tools'),
    matchKey: catalogueKey(description, unit),
  }
}
