import { netForQtyForView, rowPlannedNetForView } from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/lib/kosztorys/types'
import { FOOTER_ROWS, fold, type FooterRowKeyT } from './columns'
import type { ParsedItemT, ParsedRobociznaT } from './parse-robocizna'
import type { ResolvedRobociznaT } from './resolve-columns'

export type { FooterRowKeyT }

export type FooterComparisonT = {
  key: FooterRowKeyT
  // The sheet's own wording, so the preview names the row the owner will look for.
  label: string
  sheetValue: number | null
  appValue: number
  delta: number | null
  matches: boolean
  // Which app figure the sheet row turned out to agree with. The owner's labels do NOT reliably say
  // which of the two a row holds — on sheets where nothing is executed yet both rows carry the same
  // number, and on others „wartość netto" sits over the executed figure — so a row is checked
  // against both and reported against whichever it matches. `null` when it matches neither.
  matchedAgainst: FooterRowKeyT | null
}

// Both figures are money, so anything under a grosz is rounding, not disagreement.
const TOLERANCE = 0.005

// The parser drops the four subcontractor override fields and the import never sets a global
// discount, so the client-view price is fully determined here — the coefficients only ever feed the
// two subcontractor views.
const asPricing = (item: ParsedItemT): ViewPricingT => ({
  ...item,
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  globalDiscountActive: false,
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

/**
 * Compare the sheet's own summary rows against what the app computes from the same prace. The figure
 * depends on every price, quantity and rabat individually, so agreement is the strongest available
 * evidence that the parse read the right columns — which is why the app side goes through `calc.ts`
 * rather than a local sum: a reimplementation would agree with the parser's mistakes.
 *
 * A disagreement is reported, never thrown. Sheets with broken footer formulas exist, and refusing
 * to import because the owner's own SUM is stale would make the button useless on exactly the sheets
 * that need it.
 */
export function compareFooterTotals(
  grid: unknown[][],
  resolved: ResolvedRobociznaT,
  parsed: ParsedRobociznaT,
): FooterComparisonT[] {
  const qtyDoneByItem = new Map<number, number>()
  for (const entry of parsed.progress) {
    qtyDoneByItem.set(entry.itemId, (qtyDoneByItem.get(entry.itemId) ?? 0) + entry.qtyDone)
  }

  const appValues: Record<FooterRowKeyT, number> = {
    plannedNet: parsed.items.reduce(
      (total, item) => total + rowPlannedNetForView(asPricing(item), 'client'),
      0,
    ),
    executedNet: parsed.items.reduce(
      (total, item) =>
        total + netForQtyForView(asPricing(item), qtyDoneByItem.get(item.id) ?? 0, 'client'),
      0,
    ),
  }

  // Only rows below the last praca are summary rows: „wartość netto" is also a column header, and a
  // praca can be described in words that start the same way.
  const footer = parsed.footerStart < 0 ? [] : grid.slice(parsed.footerStart)

  return FOOTER_ROWS.map(({ key, label, matches }) => {
    const row = footer.find((cells) => cells.some((cell) => matches(fold(cell))))
    const sheetValue = row === undefined ? null : readFooterValue(row, resolved.columns.netValue)

    // Checked against both figures rather than only its namesake — see `matchedAgainst`.
    const matchedAgainst =
      sheetValue === null
        ? null
        : (FOOTER_KEYS.find(
            (candidate) => Math.abs(sheetValue - appValues[candidate]) < TOLERANCE,
          ) ?? null)
    const appValue = appValues[matchedAgainst ?? key]

    return {
      key,
      label,
      sheetValue,
      appValue,
      delta: sheetValue === null ? null : sheetValue - appValue,
      matches: matchedAgainst !== null,
      matchedAgainst,
    }
  })
}

const FOOTER_KEYS = FOOTER_ROWS.map(({ key }) => key)

// The summary figure normally sits under the „Wartość netto" column, but the owner merges cells in
// the footer freely and it lands a column or two over. A row with exactly one number in it has no
// ambiguity to resolve, so that number is taken; two or more and we'd be guessing, so we don't.
function readFooterValue(row: readonly unknown[], netValueColumn: number): number | null {
  const preferred = row[netValueColumn]
  if (typeof preferred === 'number') return preferred

  const numbers = row.filter((cell): cell is number => typeof cell === 'number')
  return numbers.length === 1 ? numbers[0] : null
}
