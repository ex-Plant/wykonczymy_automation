import { describe, it, expect } from 'vitest'
import { restorableType } from '@/components/forms/expense-form/draft-type'
import { TRANSACTION_TRANSFER_TYPES } from '@/lib/constants/transfers'

// The one write-switch gate that reaches an ordinary user: a sessionStorage draft outlives the deploy
// that removed its type from the dialog. Asserting the coerced VALUE, not that the form renders — a
// green render cannot tell „coerced" from „silently kept", and silently kept is the whole defect.

describe('restorableType', () => {
  it('coerces a type the dialog no longer offers', () => {
    expect(restorableType('LABOR_COST')).toBe('INVESTMENT_EXPENSE')
    expect(restorableType('RABAT')).toBe('INVESTMENT_EXPENSE')
  })

  it('keeps every type the dialog still offers', () => {
    for (const type of TRANSACTION_TRANSFER_TYPES) {
      expect(restorableType(type)).toBe(type)
    }
  })

  it('coerces junk rather than passing it to the form', () => {
    // A draft is user-writable storage; nothing guarantees the string is even a transfer type.
    expect(restorableType('')).toBe('INVESTMENT_EXPENSE')
    expect(restorableType('NOT_A_TYPE')).toBe('INVESTMENT_EXPENSE')
  })
})
