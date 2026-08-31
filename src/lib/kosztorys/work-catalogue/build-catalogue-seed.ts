import { MONEY_TOLERANCE, subcontractorPrice } from '@/lib/kosztorys/calc'
import type { SnapshotPayloadT, SnapshotSettingsT } from '@/lib/kosztorys/snapshot-format'
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

const CONFLICT_FIELDS: readonly SeedConflictFieldT[] = ['clientPrice', 'wToolsRate', 'ownToolsRate']

const disagrees = (occurrences: readonly SeedOccurrenceT[], field: SeedConflictFieldT) =>
  occurrences.some((o) => Math.abs(o[field] - occurrences[0][field]) > MONEY_TOLERANCE)

type GroupT = { description: string; unit: string; occurrences: SeedOccurrenceT[] }

/**
 * Turn a saved szablon into the cennik rows it implies, plus the rozbieżności it contains.
 *
 * Pure on purpose: the interesting behaviour is the winner rule over hundreds of real occurrences,
 * and that has to be assertable without a database. The script that writes the rows does the I/O.
 *
 * `settings` carries the investment's global współczynniki, and dropping them would be silent, not
 * loud: `subcontractorPrice` reads a missing coefficient as 0, so every praca without its own
 * nadpisanie (137 of 373 on the current szablon) would seed a 0 zł stawka.
 */
export function buildCatalogueSeed(
  payload: SnapshotPayloadT,
  settings: SnapshotSettingsT,
): { items: CatalogueSeedItemT[]; conflicts: SeedConflictT[] } {
  const sectionName = new Map(payload.sections.map((section) => [section.id, section.name]))

  const asPlanePricing = (item: KosztorysItemT): ViewPricingT => ({
    ...item,
    globalDiscountActive: false,
    globalWToolsCoeff: settings.wToolsCoeff,
    globalOwnToolsCoeff: settings.ownToolsCoeff,
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
      wToolsRate: subcontractorPrice(asPlanePricing(item), 'w_tools'),
      ownToolsRate: subcontractorPrice(asPlanePricing(item), 'own_tools'),
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
      wToolsRate: winningValue(occurrences.map((o) => o.wToolsRate)),
      ownToolsRate: winningValue(occurrences.map((o) => o.ownToolsRate)),
      matchKey,
    })

    const fields = CONFLICT_FIELDS.filter((field) => disagrees(occurrences, field))
    if (fields.length > 0)
      conflicts.push({ matchKey, description: group.description, fields, occurrences })
  }

  return { items, conflicts }
}
