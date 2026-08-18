import { describe, it, expect } from 'vitest'
import {
  isTransferType,
  requiresInvestment,
  needsSourceRegister,
  showsInvestment,
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
} from '@/lib/constants/transfers'

describe('RABAT transfer type', () => {
  it('is a recognised transfer type with a Polish label', () => {
    expect(isTransferType('RABAT')).toBe(true)
    expect(TRANSFER_TYPE_LABELS.RABAT).toBe('Rabat')
  })

  it('requires an investment and shows the investment field', () => {
    expect(requiresInvestment('RABAT')).toBe(true)
    expect(showsInvestment('RABAT')).toBe(true)
  })

  it('has no source register (like LABOR_COST)', () => {
    expect(needsSourceRegister('RABAT')).toBe(false)
  })

  it('is offered by the transaction transfer dialog again', () => {
    // EX-649 reverses EX-555 temporarily. Rabat does come from the kosztorys, but only once the
    // investment's kosztorys is IN the app — while it is still a spreadsheet the reading is 0 zł, and
    // with the dialog also refusing the booking there would be no route to settle it at all. Double
    // counting is made visible by the „Robocizna v1 / v2 / Różnica" columns instead of prevented.
    // EX-712 takes this back out once „Różnica" is zero everywhere.
    expect(TRANSACTION_TRANSFER_TYPES).toContain('RABAT')
  })
})
