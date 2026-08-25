import { effectiveCoeff, subcontractorPrice } from '@/lib/kosztorys/calc'
import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { OVERRIDE_FIELDS } from '@/lib/kosztorys/constants'
import { formatPLN } from '@/lib/utils/format-currency'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { round6 } from '@/lib/utils/round'
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
 * „Cena j.m." (`mode: 'amount'`) and „Mnożnik" (`mode: 'coeff'`) of a subcontractor view as one
 * policy, because both columns write the same field pair — the column typed into is what picks the
 * mode, so a hand-typed price IS „kwota stała" and nobody has to visit „Źródło" first.
 *
 * The only one of the three cell families that carries a `guard`: the ceiling is a rule about what
 * the company may pay a crew, and it has no business on the client's own price.
 *
 * „Mnożnik" is the sharp end of the prefix trap the rollback exists for — its prefixes start at the
 * leading „0", so a refused „0,9" used to strand the row at a multiplier of zero.
 */
export function subcontractorPolicy<RowT extends ViewPricingT>(
  view: ToolPlaneT,
  mode: SubcontractorOverrideTypeT,
): CellEditPolicyT<RowT, OverrideSnapshotT> {
  return {
    snapshot: (row) => overrideSnapshot(row, view),
    sameEntry: (a, b) => a.type === b.type && a.value === b.value,
    restore: (row, entry) => withOverride(row, view, entry),
    applyValue: (row, value) => withOverride(row, view, { type: mode, value }),
    clear: (row) => withOverride(row, view, { type: null, value: 0 }),
    guard: (row) => checkSubcontractorPrice(row, view),
    // Carries „zł" even under „Mnożnik": what a refusal restores is the row's PRICE, and a bare
    // „70,00" in a toast fired from the multiplier column reads as a multiplier of seventy.
    restoredLabel: (row) => formatPLN(subcontractorPrice(row, view)),
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
