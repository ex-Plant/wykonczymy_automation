import { describe, it, expect } from 'vitest'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'

const item = {
  description: 'x',
  amount: '-1000',
  netAmount: '',
  invoiceNote: '',
  category: '',
  expenseCategory: '7',
}

describe('mapLineItem', () => {
  it('keeps expenseCategory for a CORRECTION line item WHEN it has an investment', () => {
    expect(mapLineItem(item, 'CORRECTION', true).expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a CORRECTION line item with no investment', () => {
    expect(mapLineItem(item, 'CORRECTION', false).expenseCategory).toBeUndefined()
  })

  it('keeps expenseCategory for an INVESTMENT_EXPENSE line item (any investment flag)', () => {
    expect(mapLineItem(item, 'INVESTMENT_EXPENSE').expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a type that does not use it (OTHER)', () => {
    expect(mapLineItem(item, 'OTHER', true).expenseCategory).toBeUndefined()
  })

  it('coerces amount to a number', () => {
    expect(mapLineItem(item, 'CORRECTION', true).amount).toBe(-1000)
  })

  // The netto figure rides only on the type that BILLS at it: on any other type a persisted
  // netAmount would sit unread until someone changed the type and silently started billing it.
  describe('netAmount', () => {
    const netItem = { ...item, amount: '1230', netAmount: '1000' }

    it('rides along for the netto expense type', () => {
      expect(mapLineItem(netItem, 'INVESTMENT_EXPENSE_NET').netAmount).toBe(1000)
    })

    it('is dropped for a brutto-billed type even when the form carries one', () => {
      expect(mapLineItem(netItem, 'INVESTMENT_EXPENSE').netAmount).toBeUndefined()
    })

    it('is undefined — never 0 — when the netto type has no value typed', () => {
      expect(mapLineItem({ ...item, netAmount: '' }, 'INVESTMENT_EXPENSE_NET').netAmount)
        .toBeUndefined()
    })
  })
})
