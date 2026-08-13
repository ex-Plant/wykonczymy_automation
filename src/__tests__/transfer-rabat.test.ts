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

  it('is no longer offered by the transaction transfer dialog', () => {
    // The write-switch (EX-555): rabat comes from the kosztorys, so booking one by hand would
    // double-count against it. Every assertion above still holds — the type is live for legacy rows.
    expect(TRANSACTION_TRANSFER_TYPES).not.toContain('RABAT')
  })
})
