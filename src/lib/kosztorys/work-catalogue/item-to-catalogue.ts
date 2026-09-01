import { subcontractorPrice } from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/section-category'
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
  // Unreachable: only a plane with its own nadpisanie is priced here, and neither a kwota nor a
  // mnożnik consults a global współczynnik.
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

/**
 * The cennik row a praca from the rozpiska implies.
 *
 * Each stawka is decided SEPARATELY, and the question is whether this pozycja said anything of its
 * own about that plane. Its own nadpisanie — kwota or mnożnik — is a decision, so the effective
 * kwota is frozen into the cennik. No nadpisanie means the pozycja was only riding the
 * inwestycja's global współczynnik, and freezing that would weld one investment's współczynnik into
 * a cennik every future investment reads — so the plane goes in as `null` = „auto" and prices off
 * whichever inwestycja the praca lands in next. Cena is the pre-rabat `clientPrice`: a rabat is a
 * concession on one offer, never part of the cennik.
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
    wToolsRate: source.wToolsOverrideType === null ? null : subcontractorPrice(pricing, 'w_tools'),
    ownToolsRate:
      source.ownToolsOverrideType === null ? null : subcontractorPrice(pricing, 'own_tools'),
    matchKey: catalogueKey(description, unit),
  }
}
