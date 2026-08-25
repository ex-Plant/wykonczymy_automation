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
})
