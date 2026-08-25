import { describe, it, expect } from 'vitest'
import { discountFromType } from '@/lib/kosztorys/discount-edit'

// Regression guard for the orphan bug: discountType and discountValue are independent fields, so
// the grid could hold a value with no type — applyDiscount ignores it, and the row showed a rabat
// of 10 next to a computed discount of 0.00. Both edit directions must keep the pair consistent —
// the value direction is `discountPolicy` and lives in cell-edit.test.ts.

const NO_DISCOUNT = { discountType: null, discountValue: 0 } as const

describe('discountFromType', () => {
  it('clears the value when the type is cleared, leaving no orphan', () => {
    expect(discountFromType({ discountType: 'percent', discountValue: 10 }, null)).toEqual(
      NO_DISCOUNT,
    )
  })

  it('keeps the value when switching between percent and amount', () => {
    expect(discountFromType({ discountType: 'percent', discountValue: 10 }, 'amount')).toEqual({
      discountType: 'amount',
      discountValue: 10,
    })
  })

  // The ceiling is on the value cell, so a rabat of 150 zł flipped to „%" is the one route that
  // reaches 150% without a keystroke ever passing the guard (EX-736).
  it('caps the carried value at 100 when the switch is INTO percent', () => {
    expect(discountFromType({ discountType: 'amount', discountValue: 150 }, 'percent')).toEqual({
      discountType: 'percent',
      discountValue: 100,
    })
  })

  it('leaves a value the percent plane accepts alone', () => {
    expect(discountFromType({ discountType: 'amount', discountValue: 40 }, 'percent')).toEqual({
      discountType: 'percent',
      discountValue: 40,
    })
  })
})
