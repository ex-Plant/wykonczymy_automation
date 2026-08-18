import { effectiveCoeff, subcontractorPrice } from '@/lib/kosztorys/calc'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { round6 } from '@/lib/utils/round'
import type { SubcontractorOverrideTypeT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/** What the override looked like when the user entered the cell — what a rejected edit rolls back to. */
export type OverrideSnapshotT = {
  type: SubcontractorOverrideTypeT | null
  value: number
}

export type PriceSettleT<RowT> =
  /** The row already says what the user left behind. */
  | { kind: 'keep' }
  /** An emptied field — the override reverts to „auto". */
  | { kind: 'clear'; row: RowT }
  | {
      kind: 'rollback'
      reason: 'blocked' | 'invalid'
      /** `null` when the row is already back where it started and only the announcement is owed. */
      row: RowT | null
      restoredPrice: number
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

/** The row with one plane's override replaced — the write every transition below resolves to. */
export function withOverride<RowT extends ViewPricingT>(
  rowData: RowT,
  view: ToolPlaneT,
  snapshot: OverrideSnapshotT,
): RowT {
  const { type, value } = OVERRIDE_FIELDS[view]
  return { ...rowData, [type]: snapshot.type, [value]: snapshot.value }
}

/**
 * One keystroke in „Cena j.m." (`mode: 'amount'`) or „Mnożnik" (`mode: 'coeff'`) of a subcontractor
 * view. One machine for both because both columns write the same field pair — the column typed into
 * is what picks the mode, so a hand-typed price IS „kwota stała" and nobody has to visit „Źródło"
 * first.
 *
 * `hold` is the important case: an emptied field must NOT write `type: null` back to the row.
 * Doing so flips the cell out of edit mode mid-typing, which swaps the input for read-only text —
 * the caret dies and the old value reappears under the user's hands. Clearing only takes effect
 * once the user leaves the cell, via `priceSettle`.
 */
export function priceKeystroke<RowT extends ViewPricingT>(
  raw: string,
  rowData: RowT,
  view: ToolPlaneT,
  mode: SubcontractorOverrideTypeT,
): PriceKeystrokeT<RowT> {
  const parsed = parseDecimalInput(raw)
  if (parsed.kind !== 'value') return { kind: 'hold' }

  const row = withOverride(rowData, view, { type: mode, value: parsed.value })
  const refusal = checkSubcontractorPrice(row, view)
  if (refusal) return { kind: 'blocked', message: refusal }
  return { kind: 'commit', row }
}

/**
 * Leaving the cell.
 *
 * The rollback is what makes a rejected edit safe: keystrokes commit as they go, so typing
 * „2344000" writes 2, 23, 234 … until one crosses the ceiling and the rest are refused. Without
 * this, walking away left the last accepted PREFIX standing as if the user had chosen it — a value
 * they never typed, in a cell they were told had failed. „Mnożnik" is the worse half: its prefixes
 * start at the leading „0", so a refused „0,9" used to strand the row at a multiplier of zero.
 *
 * `reason` is what the caller announces: a refused value owes the user a word, because their number
 * is gone and an older one is on screen in its place. So does an unparseable one that displaced a
 * committed prefix — only garbage that changed nothing goes without a word, the way every text field
 * on earth discards it.
 */
export function priceSettle<RowT extends ViewPricingT>(
  draft: string,
  rowData: RowT,
  view: ToolPlaneT,
  mode: SubcontractorOverrideTypeT,
  entry: OverrideSnapshotT,
): PriceSettleT<RowT> {
  const parsed = parseDecimalInput(draft)
  if (parsed.kind === 'empty') {
    return { kind: 'clear', row: withOverride(rowData, view, { type: null, value: 0 }) }
  }

  const result = priceKeystroke(draft, rowData, view, mode)
  if (result.kind === 'commit') return { kind: 'keep' }

  const restored = withOverride(rowData, view, entry)
  const current = overrideSnapshot(rowData, view)
  const settled = current.type === entry.type && current.value === entry.value
  return {
    kind: 'rollback',
    reason: result.kind === 'blocked' ? 'blocked' : 'invalid',
    // Null once the row already stands where the rollback would put it — the announcement is still
    // owed, only the write isn't.
    row: settled ? null : restored,
    restoredPrice: subcontractorPrice(restored, view),
  }
}

/**
 * Switching „Źródło".
 *
 * The value slot is shared, so the mode alone decides how the stored number is read — and carrying
 * it across unread turned a 200 zł flat price into a multiplier of 200 (a 20 000 zł row the guard
 * never saw, because no keystroke went through it) and a 0,65 multiplier into a price of 65 groszy.
 * Re-seeding from the price the row already shows keeps the switch to what it claims to be — a
 * change of source, not of price — which is also what makes it safe: whatever passed the guard
 * before still passes after.
 *
 * „auto" is the exception, and honestly so: it means „whatever the investment says", so it drops the
 * row's own number and the price follows the global multiplier.
 */
export function modeChange<RowT extends ViewPricingT>(
  rowData: RowT,
  next: SubcontractorOverrideTypeT | null,
  view: ToolPlaneT,
): RowT {
  if (next === null) return withOverride(rowData, view, { type: null, value: 0 })

  const price = subcontractorPrice(rowData, view)
  if (next === 'amount') return withOverride(rowData, view, { type: 'amount', value: price })

  const coeff =
    // A back-computed multiplier carries the float tail of price ÷ client price, and it has to land on
    // the same places the import rounds to — `deriveOverride` decides „auto" by an exact comparison
    // against the investment's mnożnik, so two precisions would re-save an auto row as an override.
    rowData.clientPrice > 0 ? round6(price / rowData.clientPrice) : effectiveCoeff(rowData, view)
  return withOverride(rowData, view, { type: 'coeff', value: coeff })
}
