import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import type {
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
  ToolPlaneT,
  ViewPricingT,
} from '@/lib/kosztorys/types'

// Which pair of row fields a subcontractor plane writes to. Lives here rather than next to the cells
// because the edit transitions below are the only thing that has to agree with it.
export const OVERRIDE_FIELDS: Record<
  ToolPlaneT,
  { type: keyof ViewPricingT; value: keyof ViewPricingT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

/** What the override looked like when the user entered the cell — what a rejected edit rolls back to. */
export type OverrideSnapshotT = {
  type: SubcontractorOverrideTypeT | null
  value: number
}

export type PriceKeystrokeT<RowT> =
  /** Text stands on screen, the row is untouched — a cleared field or half-typed garbage. */
  { kind: 'hold' } | { kind: 'blocked'; message: string } | { kind: 'commit'; row: RowT }

// A derived multiplier is stored, not displayed arithmetic, so it must not carry the full float tail
// of price ÷ price. Six places keep the round-trip exact to the grosz at any realistic unit price.
const COEFF_PLACES = 1e6

export function overrideSnapshot(rowData: ViewPricingT, view: ToolPlaneT): OverrideSnapshotT {
  const { type, value } = OVERRIDE_FIELDS[view]
  return {
    type: rowData[type] as SubcontractorOverrideTypeT | null,
    value: rowData[value] as number,
  }
}

function withOverride<RowT extends ViewPricingT>(
  rowData: RowT,
  view: ToolPlaneT,
  snapshot: OverrideSnapshotT,
): RowT {
  const { type, value } = OVERRIDE_FIELDS[view]
  return { ...rowData, [type]: snapshot.type, [value]: snapshot.value }
}

/**
 * Typing a price does NOT mean "make this a flat amount". Unless the row is already on „kwota stała",
 * the price is expressed as a share of the client price, so we back-compute the multiplier and let
 * „Mnożnik" follow — the user changes the figure they care about and the mode stays where they put
 * it. A zero client price has no share to express, so it can only be a flat amount.
 */
function overrideForPrice(
  price: number,
  rowData: ViewPricingT,
  view: ToolPlaneT,
): OverrideSnapshotT {
  const current = overrideSnapshot(rowData, view).type
  if (current === 'amount' || !(rowData.clientPrice > 0)) return { type: 'amount', value: price }
  return {
    type: 'coeff',
    value: Math.round((price / rowData.clientPrice) * COEFF_PLACES) / COEFF_PLACES,
  }
}

/**
 * One keystroke in the „Cena j.m." cell of a subcontractor view.
 *
 * `hold` is the important case: an emptied field must NOT write `type: null` back to the row.
 * Doing so flips the cell out of edit mode mid-typing, which swaps the input for read-only text —
 * the caret dies and the old price reappears under the user's hands. Clearing only takes effect
 * once the user leaves the cell, via `priceSettle`.
 */
export function priceKeystroke<RowT extends ViewPricingT>(
  raw: string,
  rowData: RowT,
  view: ToolPlaneT,
): PriceKeystrokeT<RowT> {
  const parsed = parseDecimalInput(raw)
  if (parsed.kind !== 'value') return { kind: 'hold' }

  const row = withOverride(rowData, view, overrideForPrice(parsed.value, rowData, view))
  const issue = checkSubcontractorPrice(row, view)
  // A warning commits like any other value — it is a colour, not a refusal.
  if (issue?.severity === 'error') return { kind: 'blocked', message: issue.message }
  return { kind: 'commit', row }
}

/**
 * Leaving the cell. Returns the row to write, or `null` when the row already says what the user
 * left behind.
 *
 * The rollback is what makes a rejected edit safe: keystrokes commit as they go, so typing
 * „2344000" writes 2, 23, 234 … until one crosses the ceiling and the rest are refused. Without
 * this, walking away left the last accepted PREFIX standing as if the user had chosen it — a price
 * they never typed, in a cell they were told had failed.
 */
export function priceSettle<RowT extends ViewPricingT>(
  draft: string,
  rowData: RowT,
  view: ToolPlaneT,
  entry: OverrideSnapshotT,
): RowT | null {
  const parsed = parseDecimalInput(draft)
  if (parsed.kind === 'empty') return withOverride(rowData, view, { type: null, value: 0 })

  const result = priceKeystroke(draft, rowData, view)
  if (result.kind === 'commit') return null

  const current = overrideSnapshot(rowData, view)
  if (current.type === entry.type && current.value === entry.value) return null
  return withOverride(rowData, view, entry)
}
