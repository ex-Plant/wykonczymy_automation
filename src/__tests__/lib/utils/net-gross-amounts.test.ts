import { describe, it, expect } from 'vitest'
import { grossFromNet, netFromGross } from '@/lib/utils/net-gross-amounts'

const VAT = 0.08

describe('net/gross amount crossing', () => {
  it('crosses a kwota both ways at the investment rate', () => {
    expect(grossFromNet('10000', VAT)).toBe('10800.00')
    expect(netFromGross('10800', VAT)).toBe('10000.00')
  })

  it('lands back on the typed figure after a round trip', () => {
    expect(netFromGross(grossFromNet('1234.56', VAT), VAT)).toBe('1234.56')
  })

  it('yields nothing for an empty or half-typed kwota — the pair stays empty, never NaN', () => {
    expect(grossFromNet('', VAT)).toBe('')
    expect(netFromGross('', VAT)).toBe('')
    expect(grossFromNet('-', VAT)).toBe('')
  })

  it('crosses at the investment rate, not a hardcoded one', () => {
    expect(grossFromNet('100', 0.23)).toBe('123.00')
  })
})
