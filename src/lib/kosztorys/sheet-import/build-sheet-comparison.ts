import { netForQtyForView, rowPlannedNetForView } from '@/lib/kosztorys/calc'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT, StageProgressT, ViewPricingT } from '@/lib/kosztorys/types'
import { compareFooterTotals, type FooterComparisonT } from './footer-totals'
import { scanFormulaHealth, type FormulaHealthT } from './formula-health'
import { keyItems } from './item-key'
import { parseRobocizna, type ParsedItemT } from './parse-robocizna'
import type { ImportGridsT } from './read-sheet'
import { resolveRobocizna } from './resolve-columns'

export type ComparedItemT = { section: string; description: string }

export type SheetComparisonT = {
  // Both sides' money, computed through `calc.ts` on each side rather than summed locally — a
  // reimplementation would agree with the parser's own mistakes.
  totals: {
    plannedNetFromSheet: number
    plannedNetFromApp: number
    executedNetFromSheet: number
    executedNetFromApp: number
  }
  // The sheet's own summary rows against what its own prace add up to — internal consistency, the
  // same check the import preview shows.
  footer: FooterComparisonT[]
  counts: { sheetItems: number; appItems: number; matched: number }
  onlyInSheet: ComparedItemT[]
  onlyInApp: ComparedItemT[]
  // How many matched pozycje would carry a reference quantity after a refresh — the denominator
  // behind „Rozjazd nic o nich nie powie".
  referenceQty: { matched: number; withValue: number }
  health: FormulaHealthT
  // Everything a per-cell deep link needs, or null when the tab's gid didn't come back — the report
  // then prints the cell as text instead of a link that would open the wrong tab.
  sheetLink: { spreadsheetId: string; gid: number } | null
}

export type SheetComparisonResultT =
  | { ok: true; comparison: SheetComparisonT }
  | { ok: false; problems: string[] }

// Neither plane's coefficient can reach a client-plane figure, and no snapshot carries a global
// discount, so the client price is fully determined by the item itself. The parsed rows additionally
// lack the four override fields — see `ParsedItemT` — which the client view never reads.
const asClientPricing = (item: ParsedItemT | KosztorysItemT): ViewPricingT => ({
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  ...item,
  globalDiscountActive: false,
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

function sumQtyDone(progress: readonly StageProgressT[]): Map<number, number> {
  const byItem = new Map<number, number>()
  for (const entry of progress) {
    byItem.set(entry.itemId, (byItem.get(entry.itemId) ?? 0) + entry.qtyDone)
  }
  return byItem
}

function planeTotals(
  items: readonly (ParsedItemT | KosztorysItemT)[],
  progress: readonly StageProgressT[],
): { plannedNet: number; executedNet: number } {
  const qtyDone = sumQtyDone(progress)
  let plannedNet = 0
  let executedNet = 0
  for (const item of items) {
    const pricing = asClientPricing(item)
    plannedNet += rowPlannedNetForView(pricing, 'client')
    executedNet += netForQtyForView(pricing, qtyDone.get(item.id) ?? 0, 'client')
  }
  return { plannedNet, executedNet }
}

/**
 * The both-sides reckoning behind „Porównaj z arkuszem": what each side says the work is worth,
 * which pozycje exist on one side only, and how much of the sheet the „Rozjazd" column is
 * structurally blind on.
 *
 * Deliberately resolves no rates. Rates only ever feed the subcontractor overrides, so skipping them
 * keeps the comparison working on exactly the sheet that needs diagnosing — one whose „zakres pracy"
 * headers are broken, which the import itself refuses outright.
 */
export function buildSheetComparison(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  spreadsheetId: string,
): SheetComparisonResultT {
  const resolved = resolveRobocizna(grids.robocizna)
  if (!resolved.ok) return { ok: false, problems: resolved.problems }

  const parsed = parseRobocizna(grids.robocizna, resolved, grids.robociznaFormulas)

  const sheetSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const appSectionName = new Map(currentTree.sections.map((section) => [section.id, section.name]))

  const sheetByKey = keyItems(
    // `keyItems` wants full items; the parsed ones lack the four override fields, which it never
    // reads. Only the section, description and their order matter for keying.
    parsed.items as unknown as KosztorysItemT[],
    (item) => sheetSectionName.get(item.sectionId) ?? '',
  )
  const appByKey = keyItems(currentTree.items, (item) => appSectionName.get(item.sectionId) ?? '')

  const named = (item: KosztorysItemT, sectionName: Map<number, string>): ComparedItemT => ({
    section: sectionName.get(item.sectionId) ?? '',
    description: item.description ?? '',
  })

  const onlyInSheet: ComparedItemT[] = []
  const onlyInApp: ComparedItemT[] = []
  let matched = 0
  let withValue = 0

  for (const [key, item] of sheetByKey) {
    if (!appByKey.has(key)) {
      onlyInSheet.push(named(item, sheetSectionName))
      continue
    }
    matched++
    // The sheet's claim as the parser would import it — a formula or an empty cell is no claim, and
    // those rows are precisely the ones „Rozjazd" cannot speak about.
    if (item.sheetMeasuredQty !== null) withValue++
  }
  for (const [key, item] of appByKey) {
    if (!sheetByKey.has(key)) onlyInApp.push(named(item, appSectionName))
  }

  const sheetTotals = planeTotals(parsed.items, parsed.progress)
  const appTotals = planeTotals(currentTree.items, currentTree.progress)

  return {
    ok: true,
    comparison: {
      totals: {
        plannedNetFromSheet: sheetTotals.plannedNet,
        plannedNetFromApp: appTotals.plannedNet,
        executedNetFromSheet: sheetTotals.executedNet,
        executedNetFromApp: appTotals.executedNet,
      },
      footer: compareFooterTotals(grids.robocizna, resolved, parsed),
      counts: {
        sheetItems: parsed.items.length,
        appItems: currentTree.items.length,
        matched,
      },
      onlyInSheet,
      onlyInApp,
      referenceQty: { matched, withValue },
      health: scanFormulaHealth(
        grids.robocizna,
        grids.robociznaFormulas,
        resolved,
        parsed.footerStart,
      ),
      sheetLink:
        grids.robociznaGid === undefined ? null : { spreadsheetId, gid: grids.robociznaGid },
    },
  }
}
