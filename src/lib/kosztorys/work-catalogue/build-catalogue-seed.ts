import { MONEY_TOLERANCE, subcontractorPrice } from '@/lib/kosztorys/calc'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT, ViewPricingT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/section-category'
import type {
  CatalogueSeedItemT,
  SeedConflictFieldT,
  SeedConflictT,
  SeedOccurrenceT,
} from '@/lib/kosztorys/work-catalogue/types'

const GROSZ = 100

const toGrosz = (value: number): number => Math.round(value * GROSZ)

/**
 * The winner rule: the value that occurs MOST OFTEN, ties broken by the higher one.
 *
 * Not „the highest" — on the owner's szablon eight of the nine rozbieżności are one outlying sekcja
 * against three that agree to the grosz, so „highest wins" would import eight stale prices. Compared
 * in grosze because both stawki are computed (`clientPrice × coeff`), and float noise would otherwise
 * split one value into two near-identical buckets that each lose to a genuine minority.
 */
function winningValue(values: readonly number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) {
    const grosze = toGrosz(value)
    counts.set(grosze, (counts.get(grosze) ?? 0) + 1)
  }
  let winner = 0
  let winnerCount = -1
  for (const [grosze, count] of counts) {
    if (count > winnerCount || (count === winnerCount && grosze > winner)) {
      winner = grosze
      winnerCount = count
    }
  }
  return winner / GROSZ
}

/**
 * Same rule for a stawka, where „auto" (`null`) is a fourth possible answer and counts as its own
 * bucket. On a tie a kwota beats auto: a typed kwota is a decision somebody made, auto is what a
 * pozycja looks like when nobody made one.
 */
function winningRate(values: readonly (number | null)[]): number | null {
  const amounts = values.filter((value) => value !== null)
  const autoCount = values.length - amounts.length
  if (amounts.length === 0) return null
  const winner = winningValue(amounts)
  const winnerCount = amounts.filter((value) => Math.abs(value - winner) <= MONEY_TOLERANCE).length
  return autoCount > winnerCount ? null : winner
}

const CONFLICT_FIELDS: readonly SeedConflictFieldT[] = ['clientPrice', 'wToolsRate', 'ownToolsRate']

// „auto" against a kwota is a genuine rozbieżność — the szablon says two different things about how
// that plane is priced — so a missing value is not folded into the numeric comparison.
const disagrees = (occurrences: readonly SeedOccurrenceT[], field: SeedConflictFieldT) => {
  const first = occurrences[0][field]
  return occurrences.some((o) =>
    o[field] === null || first === null
      ? o[field] !== first
      : Math.abs(o[field] - first) > MONEY_TOLERANCE,
  )
}

type GroupT = { description: string; unit: string; occurrences: SeedOccurrenceT[] }

/**
 * Turn a saved szablon into the cennik rows it implies, plus the rozbieżności it contains.
 *
 * Pure on purpose: the interesting behaviour is the winner rule over hundreds of real occurrences,
 * and that has to be assertable without a database. The script that writes the rows does the I/O.
 *
 * The szablon investment's global współczynniki take no part: only a plane carrying its OWN
 * nadpisanie is priced at all, and neither a kwota nor a mnożnik reads a global. A plane without
 * one (137 of 373 prac on the current szablon) seeds as „auto" instead.
 */
export function buildCatalogueSeed(payload: SnapshotPayloadT): {
  items: CatalogueSeedItemT[]
  conflicts: SeedConflictT[]
} {
  const sectionName = new Map(payload.sections.map((section) => [section.id, section.name]))

  const asPlanePricing = (item: KosztorysItemT): ViewPricingT => ({
    ...item,
    globalDiscountActive: false,
    globalWToolsCoeff: 0,
    globalOwnToolsCoeff: 0,
  })

  const groups = new Map<string, GroupT>()
  for (const item of payload.items) {
    const description = item.description?.trim()
    if (!description) continue
    const unit = item.unit?.trim() ?? ''
    const key = catalogueKey(description, unit)
    const group = groups.get(key) ?? { description, unit, occurrences: [] }
    group.occurrences.push({
      sectionName: stripSectionOrdinal(sectionName.get(item.sectionId) ?? ''),
      clientPrice: item.clientPrice,
      // Same rule as „Zapisz do katalogu…": a pozycja that overrode nothing was only riding the
      // szablon investment's współczynnik, so it seeds as „auto" rather than welding that
      // współczynnik into the global cennik.
      wToolsRate:
        item.wToolsOverrideType === null
          ? null
          : subcontractorPrice(asPlanePricing(item), 'w_tools'),
      ownToolsRate:
        item.ownToolsOverrideType === null
          ? null
          : subcontractorPrice(asPlanePricing(item), 'own_tools'),
    })
    groups.set(key, group)
  }

  const items: CatalogueSeedItemT[] = []
  const conflicts: SeedConflictT[] = []

  for (const [matchKey, group] of groups) {
    const { occurrences } = group
    const clientPrice = winningValue(occurrences.map((o) => o.clientPrice))
    // The kategoria has no numeric winner rule of its own, so it follows the price: the first
    // occurrence that agrees with the winning „Cena j.m." is by construction one of the majority.
    const winner =
      occurrences.find((o) => Math.abs(o.clientPrice - clientPrice) <= MONEY_TOLERANCE) ??
      occurrences[0]

    items.push({
      description: group.description,
      category: winner.sectionName || null,
      unit: group.unit,
      clientPrice,
      wToolsRate: winningRate(occurrences.map((o) => o.wToolsRate)),
      ownToolsRate: winningRate(occurrences.map((o) => o.ownToolsRate)),
      matchKey,
    })

    const fields = CONFLICT_FIELDS.filter((field) => disagrees(occurrences, field))
    if (fields.length > 0)
      conflicts.push({ matchKey, description: group.description, fields, occurrences })
  }

  return { items, conflicts }
}
