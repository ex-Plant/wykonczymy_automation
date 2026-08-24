import { describe, it, expect } from 'vitest'
import { netFromGross } from '@/lib/kosztorys/net-gross-amounts'

const VAT = 0.08

describe('netFromGross', () => {
  it('crosses a brutto kwota down at the investment rate', () => {
    expect(netFromGross('10800', VAT)).toBe('10000.00')
  })

  it('crosses at the investment rate, not a hardcoded one', () => {
    expect(netFromGross('123', 0.23)).toBe('100.00')
  })

  it('yields nothing for an empty or half-typed kwota — the field stays empty, never NaN', () => {
    expect(netFromGross('', VAT)).toBe('')
    expect(netFromGross('-', VAT)).toBe('')
    expect(netFromGross('1e', VAT)).toBe('')
  })
})
