import { MONEY_TOLERANCE, subcontractorPrice } from '@/lib/kosztorys/calc'
import type { KosztorysItemT, ViewPricingT } from '@/lib/kosztorys/types'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// One figure the rozpiska and the cennik disagree about.
export type CatalogueFigureDiffT = {
  label: string
  kosztorys: number
  catalogue: number
  delta: number
}

export type CataloguePriceDiffT = {
  itemId: number
  description: string
  unit: string
  figures: CatalogueFigureDiffT[]
  // The largest of this praca's rozbieżności — what the list sorts by, so the biggest money is read
  // first rather than found.
  maxDelta: number
}

export type CatalogueMissingT = {
  itemId: number
  section: string
  description: string
  unit: string
  // The closest cennik opis, or nothing. DISPLAY ONLY — this never matches, never prices anything
  // and never decides which kubełek a praca lands in; it exists so „brak w katalogu" on a praca that
  // IS there under a slightly different name is recognisable as such.
  hint: string | null
}

export type CatalogueComparisonT = {
  matching: number
  diffs: CataloguePriceDiffT[]
  missing: CatalogueMissingT[]
}

// The sekcja rides along for the report only — the cennik is global, so it takes no part in the
// matching.
export type CatalogueComparisonItemT = KosztorysItemT & { sectionName?: string }

export type CatalogueComparisonSettingsT = { wToolsCoeff: number; ownToolsCoeff: number }

// Below this the two names have nothing to do with each other and a hint would be noise — an owner
// who reads „może chodzi o…" over an unrelated praca stops reading the hints at all.
const HINT_THRESHOLD = 0.55

const asPricing = (item: KosztorysItemT, settings: CatalogueComparisonSettingsT): ViewPricingT => ({
  ...item,
  globalDiscountActive: false,
  globalWToolsCoeff: settings.wToolsCoeff,
  globalOwnToolsCoeff: settings.ownToolsCoeff,
})

// Dice over letter bigrams: cheap, order-insensitive enough for „Gładź gipsowa" against „Gładzie
// gipsowe", and — unlike a prefix test — unbothered by a difference at the front of the name.
function bigrams(value: string): string[] {
  const pairs: string[] = []
  for (let i = 0; i < value.length - 1; i += 1) pairs.push(value.slice(i, i + 2))
  return pairs
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 1
  const leftPairs = bigrams(left)
  const rightPairs = bigrams(right)
  if (leftPairs.length === 0 || rightPairs.length === 0) return 0

  const pool = new Map<string, number>()
  for (const pair of leftPairs) pool.set(pair, (pool.get(pair) ?? 0) + 1)

  let shared = 0
  for (const pair of rightPairs) {
    const left = pool.get(pair) ?? 0
    if (left > 0) {
      shared += 1
      pool.set(pair, left - 1)
    }
  }
  return (2 * shared) / (leftPairs.length + rightPairs.length)
}

function closestDescription(description: string, catalogue: readonly WorkCatalogueItemT[]) {
  const folded = foldDescription(description)
  let best: { description: string; score: number } | null = null
  for (const entry of catalogue) {
    const score = similarity(folded, foldDescription(entry.description))
    if (!best || score > best.score) best = { description: entry.description, score }
  }
  return best && best.score >= HINT_THRESHOLD ? best.description : null
}

const figure = (
  label: string,
  kosztorys: number,
  catalogue: number,
): CatalogueFigureDiffT | null => {
  const delta = kosztorys - catalogue
  return Math.abs(delta) > MONEY_TOLERANCE ? { label, kosztorys, catalogue, delta } : null
}

/**
 * The rozpiska against the cennik: which prace agree, which disagree on money, which the cennik has
 * never heard of. Reports, never writes — the two are allowed to differ, and this only says where.
 *
 * Compares all three liczby, because a praca can carry the offered cena and still pay the
 * podwykonawca something else entirely — the stawki are exactly where a szablon goes stale. Every
 * comparison is at `MONEY_TOLERANCE`: a stawka derived as `cena × współczynnik` never equals the
 * frozen kwota to the last float bit, and a report that flagged that would flag every single row.
 */
export function buildCatalogueComparison(
  items: readonly CatalogueComparisonItemT[],
  catalogue: readonly WorkCatalogueItemT[],
  settings: CatalogueComparisonSettingsT,
): CatalogueComparisonT {
  const byKey = new Map(catalogue.map((entry) => [entry.matchKey, entry]))
  const diffs: CataloguePriceDiffT[] = []
  const missing: CatalogueMissingT[] = []
  let matching = 0

  for (const item of items) {
    const description = (item.description ?? '').trim()
    const unit = (item.unit ?? '').trim()
    // A praca with no name is a blank line the owner has not filled in yet, not a rozjazd.
    if (!description) continue

    const entry = byKey.get(catalogueKey(description, unit))
    if (!entry) {
      missing.push({
        itemId: item.id,
        section: item.sectionName ?? '',
        description,
        unit,
        hint: closestDescription(description, catalogue),
      })
      continue
    }

    const pricing = asPricing(item, settings)
    const figures = [
      figure('Cena j.m.', item.clientPrice, entry.clientPrice),
      figure('Stawka z narzędziami', subcontractorPrice(pricing, 'w_tools'), entry.wToolsRate),
      figure('Stawka bez narzędzi', subcontractorPrice(pricing, 'own_tools'), entry.ownToolsRate),
    ].filter((diff) => diff !== null)

    if (figures.length === 0) {
      matching += 1
      continue
    }

    diffs.push({
      itemId: item.id,
      description,
      unit,
      figures,
      maxDelta: Math.max(...figures.map((diff) => Math.abs(diff.delta))),
    })
  }

  diffs.sort((left, right) => right.maxDelta - left.maxDelta)

  return { matching, diffs, missing }
}
