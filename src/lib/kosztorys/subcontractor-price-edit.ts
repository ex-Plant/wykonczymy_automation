import { subcontractorPrice } from '@/lib/kosztorys/calc'
import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { formatPLN } from '@/lib/utils/format-currency'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { SubcontractorOverrideTypeT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

/** What the override looked like when the user entered the cell — what a rejected edit rolls back to. */
export type OverrideSnapshotT = {
  type: SubcontractorOverrideTypeT | null
  value: number
}

export function overrideSnapshot(rowData: ViewPricingT, view: ToolPlaneT): OverrideSnapshotT {
  const { type, value } = OVERRIDE_FIELDS[view]
  return {
    type: rowData[type] as SubcontractorOverrideTypeT | null,
    value: rowData[value] as number,
  }
}

/** The row with one plane's override replaced — the write every transition below resolves to. */
function withOverride<RowT extends ViewPricingT>(
  rowData: RowT,
  view: ToolPlaneT,
  snapshot: OverrideSnapshotT,
): RowT {
  const { type, value } = OVERRIDE_FIELDS[view]
  return { ...rowData, [type]: snapshot.type, [value]: snapshot.value }
}

/**
 * „Cena j.m." of a subcontractor view. A typed number IS „kwota stała" — the keystroke carries the
 * źródło with it, so nobody has to visit „Źródło" first — and clearing the cell is the way back to
 * „auto".
 *
 * The only cell family that carries a `guard`: the ceiling is a rule about what the company may pay
 * a crew, and it has no business on the client's own price.
 */
export function subcontractorPolicy<RowT extends ViewPricingT>(
  view: ToolPlaneT,
): CellEditPolicyT<RowT, OverrideSnapshotT> {
  return {
    snapshot: (row) => overrideSnapshot(row, view),
    sameEntry: (a, b) => a.type === b.type && a.value === b.value,
    restore: (row, entry) => withOverride(row, view, entry),
    applyValue: (row, value) => withOverride(row, view, { type: 'amount', value }),
    clear: (row) => withOverride(row, view, { type: null, value: 0 }),
    guard: (row) => checkSubcontractorPrice(row, view),
    restoredLabel: (row) => formatPLN(subcontractorPrice(row, view)),
  }
}

/**
 * Switching „Źródło".
 *
 * „kwota stała" is seeded with the price the row already SHOWS, so the switch is what it claims to be
 * — a change of source, not of price — which is also what makes it safe: whatever passed the guard
 * before still passes after. „auto" means „whatever the investment says", so it drops the row's own
 * number and the price follows the global mnożnik.
 */
export function modeChange<RowT extends ViewPricingT>(
  rowData: RowT,
  next: SubcontractorOverrideTypeT | null,
  view: ToolPlaneT,
): RowT {
  if (next === null) return withOverride(rowData, view, { type: null, value: 0 })
  return withOverride(rowData, view, { type: 'amount', value: subcontractorPrice(rowData, view) })
}
