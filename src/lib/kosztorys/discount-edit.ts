import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { formatNet, formatQty } from '@/lib/kosztorys/format'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import type { DiscountTypeT } from '@/lib/kosztorys/types'

// discountType and discountValue are two independent fields, and applyDiscount reads the type
// first — so a value with no type is inert: it sits in the grid looking like a live discount while
// contributing nothing. These transitions keep the pair consistent from both directions, and live
// here (not in the cell) because the trap is the state transition, not the input element.

export type DiscountPairT = { discountType: DiscountTypeT | null; discountValue: number }

// Percent, not amount: a rabat is asked for in % far more often than in zł.
const IMPLIED_TYPE: DiscountTypeT = 'percent'

/** A parsed value onto the pair — the half `discountFromValue` and the cell policy share. */
function withDiscountValue<RowT extends DiscountPairT>(current: RowT, value: number): RowT {
  return { ...current, discountType: current.discountType ?? IMPLIED_TYPE, discountValue: value }
}

export function discountFromValue(current: DiscountPairT, raw: string): DiscountPairT | null {
  const parsed = parseDecimalInput(raw)
  if (parsed.kind === 'empty') return { discountType: null, discountValue: 0 }
  // Reject rather than clear: mid-typing garbage ("1e", "-") must not wipe the row's discount.
  if (parsed.kind === 'invalid') return null
  return withDiscountValue(current, parsed.value)
}

export function discountFromType(
  current: DiscountPairT,
  next: DiscountTypeT | null,
): DiscountPairT {
  return { discountType: next, discountValue: next === null ? 0 : current.discountValue }
}

/**
 * „Rabat wart." as a cell policy. No guard — a rabat has no ceiling — but the pair is the point:
 * every write moves both fields together, which is the orphan-value bug this module exists for.
 */
export function discountPolicy<RowT extends DiscountPairT>(): CellEditPolicyT<RowT, DiscountPairT> {
  return {
    snapshot: (row) => ({ discountType: row.discountType, discountValue: row.discountValue }),
    sameEntry: (a, b) => a.discountType === b.discountType && a.discountValue === b.discountValue,
    restore: (row, entry) => ({ ...row, ...entry }),
    applyValue: withDiscountValue,
    clear: (row) => ({ ...row, discountType: null, discountValue: 0 }),
    // Named in the unit the row was actually carrying — „przywrócono 10" reads as złotówki to
    // anyone who wasn't looking at „Rabat" when the toast fired.
    restoredLabel: (row) =>
      row.discountType === null
        ? 'brak rabatu'
        : row.discountType === 'amount'
          ? `${formatNet(row.discountValue)} zł`
          : `${formatQty(row.discountValue)}%`,
  }
}
