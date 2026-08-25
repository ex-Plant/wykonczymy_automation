import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import type { DiscountTypeT } from '@/lib/kosztorys/types'

// discountType and discountValue are two independent fields, and applyDiscount reads the type
// first — so a value with no type is inert: it sits in the grid looking like a live discount while
// contributing nothing. These transitions keep the pair consistent from both directions, and live
// here (not in the cell) because the trap is the state transition, not the input element.

export type DiscountPairT = { discountType: DiscountTypeT | null; discountValue: number }

// Percent, not amount: a rabat is asked for in % far more often than in zł.
const IMPLIED_TYPE: DiscountTypeT = 'percent'

/**
 * A rabat of 100% is work given away — a real commercial decision, so it stands. Above it the row's
 * net goes negative and that figure travels on into the section and footer totals, where it reads as
 * the client being owed money for work that was done. Refused outright rather than warned about
 * (owner, 2026-08-25).
 *
 * The ceiling is on the PERCENT plane only: „250" in a rabat kwotowy is 250 zł, an ordinary figure.
 */
export const MAX_DISCOUNT_PERCENT = 100

function withDiscountValue<RowT extends DiscountPairT>(current: RowT, value: number): RowT {
  return { ...current, discountType: current.discountType ?? IMPLIED_TYPE, discountValue: value }
}

export function discountFromType(
  current: DiscountPairT,
  next: DiscountTypeT | null,
): DiscountPairT {
  if (next === null) return { discountType: null, discountValue: 0 }
  // The value slot is shared, so switching type re-reads the same number under new rules — and 150
  // zł read as a percentage is the one way past the cell's ceiling, no keystroke involved. Capped
  // rather than cleared: the switch is a change of UNIT, and dropping the figure would make the user
  // retype a rabat they had already entered.
  const value =
    next === 'percent'
      ? Math.min(current.discountValue, MAX_DISCOUNT_PERCENT)
      : current.discountValue
  return { discountType: next, discountValue: value }
}

/**
 * „Rabat wart." as a cell policy. The pair is the point: every write moves both fields together,
 * which is the orphan-value bug this module exists for. The guard reads that same pair, because
 * whether a typed „150" is out of range depends entirely on the type standing next to it.
 */
export function discountPolicy<RowT extends DiscountPairT>(): CellEditPolicyT<RowT, DiscountPairT> {
  return {
    snapshot: (row) => ({ discountType: row.discountType, discountValue: row.discountValue }),
    sameEntry: (a, b) => a.discountType === b.discountType && a.discountValue === b.discountValue,
    restore: (row, entry) => ({ ...row, ...entry }),
    applyValue: withDiscountValue,
    clear: (row) => ({ ...row, discountType: null, discountValue: 0 }),
    guard: (row) =>
      row.discountType === 'percent' && row.discountValue > MAX_DISCOUNT_PERCENT
        ? `Rabat nie może przekroczyć ${MAX_DISCOUNT_PERCENT}%.`
        : null,
    // Named in the unit the row was actually carrying — „przywrócono 10" reads as złotówki to
    // anyone who wasn't looking at „Rabat" when the toast fired.
    restoredLabel: (row) =>
      row.discountType === null
        ? 'brak rabatu'
        : row.discountType === 'amount'
          ? formatPLN(row.discountValue)
          : `${formatQty(row.discountValue)}%`,
  }
}
