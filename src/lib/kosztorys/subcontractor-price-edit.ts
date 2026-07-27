import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import type { KosztorysV2RowT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// Which pair of row fields a subcontractor plane writes to. Lives here rather than next to the cells
// because the edit transitions below are the only thing that has to agree with it.
export const OVERRIDE_FIELDS: Record<
  ToolPlaneT,
  { type: keyof KosztorysV2RowT; value: keyof KosztorysV2RowT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

export type PriceKeystrokeT<RowT> =
  /** Text stands on screen, the row is untouched — a cleared field or half-typed garbage. */
  { kind: 'hold' } | { kind: 'blocked'; message: string } | { kind: 'commit'; row: RowT }

/**
 * One keystroke in the „Cena j.m." cell of a subcontractor view.
 *
 * `hold` is the important case: an emptied field must NOT write `type: null` back to the row.
 * Doing so flips the cell out of 'amount' mode mid-edit, which swaps the input for read-only text —
 * the caret dies and the old price reappears under the user's hands. Clearing only takes effect
 * once they leave the cell, via `priceExitEdit`.
 */
export function priceKeystroke<RowT extends ViewPricingT>(
  raw: string,
  rowData: RowT,
  view: ToolPlaneT,
): PriceKeystrokeT<RowT> {
  const parsed = parseDecimalInput(raw)
  if (parsed.kind !== 'value') return { kind: 'hold' }

  const { type, value } = OVERRIDE_FIELDS[view]
  const row = { ...rowData, [type]: 'amount', [value]: parsed.value }
  const issue = checkSubcontractorPrice(row, view)
  // A warning commits like any other value — it is a colour, not a refusal.
  if (issue?.severity === 'error') return { kind: 'blocked', message: issue.message }
  return { kind: 'commit', row }
}

/**
 * Leaving the cell. Returns the row to write, or `null` when there is nothing to settle — an
 * emptied field is what reverts the override to „auto".
 */
export function priceExitEdit<RowT extends ViewPricingT>(
  draft: string,
  rowData: RowT,
  view: ToolPlaneT,
): RowT | null {
  if (parseDecimalInput(draft).kind !== 'empty') return null
  const { type, value } = OVERRIDE_FIELDS[view]
  return { ...rowData, [type]: null, [value]: 0 }
}
