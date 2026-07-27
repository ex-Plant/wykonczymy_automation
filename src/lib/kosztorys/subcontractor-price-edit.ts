import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import type { SubcontractorOverrideTypeT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

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
 * One keystroke in the „Cena j.m." cell of a subcontractor view.
 *
 * A hand-typed price IS „kwota stała" — a figure the row states outright rather than derives — so
 * the keystroke carries the mode with it: „Źródło" flips to „kwota stała" and „Mnożnik" goes to „—",
 * because the row no longer has one. Nobody has to visit „Źródło" first to be allowed to type.
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

  const row = withOverride(rowData, view, { type: 'amount', value: parsed.value })
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
