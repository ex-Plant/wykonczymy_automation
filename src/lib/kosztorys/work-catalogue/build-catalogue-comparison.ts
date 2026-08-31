import { MONEY_TOLERANCE, subcontractorPrice } from '@/lib/kosztorys/calc'
import type { KosztorysItemT, ViewPricingT } from '@/lib/kosztorys/types'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type {
  CatalogueComparisonItemT,
  CatalogueComparisonSettingsT,
  CatalogueComparisonT,
  CatalogueFigureDiffT,
  CatalogueMissingT,
  CataloguePriceDiffT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { bigrams, diceSimilarity } from '@/lib/utils/string-similarity'

// Below this the two names have nothing to do with each other and a hint would be noise — an owner
// who reads „może chodzi o…" over an unrelated praca stops reading the hints at all.
const HINT_THRESHOLD = 0.55

const asPricing = (item: KosztorysItemT, settings: CatalogueComparisonSettingsT): ViewPricingT => ({
  ...item,
  globalDiscountActive: false,
  globalWToolsCoeff: settings.wToolsCoeff,
  globalOwnToolsCoeff: settings.ownToolsCoeff,
})

type HintCandidateT = { description: string; pairs: string[] }

// Folded and bigrammed ONCE for the whole cennik: `foldDescription` is ~45 split/join passes, and a
// 1000-row rozpiska against a few-hundred-row cennik would otherwise run it a million times inside
// one server action.
const hintCandidates = (catalogue: readonly WorkCatalogueItemT[]): HintCandidateT[] =>
  catalogue.map((entry) => ({
    description: entry.description,
    pairs: bigrams(foldDescription(entry.description)),
  }))

function closestDescription(description: string, candidates: readonly HintCandidateT[]) {
  const pairs = bigrams(foldDescription(description))
  let best: { description: string; score: number } | null = null
  for (const candidate of candidates) {
    const score = diceSimilarity(pairs, candidate.pairs)
    if (!best || score > best.score) best = { description: candidate.description, score }
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
  const candidates = hintCandidates(catalogue)
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
        hint: closestDescription(description, candidates),
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
