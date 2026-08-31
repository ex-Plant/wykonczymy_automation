import { describe, expect, it } from 'vitest'
import {
  toMoney,
  workCatalogueItemSchema,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'

const values = (overrides: Partial<Record<string, unknown>> = {}) => ({
  description: 'Malowanie ścian',
  category: 'Malowanie',
  unit: 'm2',
  clientPrice: 50,
  wToolsRate: 30,
  ownToolsRate: 20,
  ...overrides,
})

describe('toMoney', () => {
  it('reads a comma as the decimal separator', () => {
    expect(toMoney('12,50')).toBe(12.5)
  })

  it('refuses a blank field instead of reading it as 0 zł', () => {
    expect(toMoney('')).toBeNaN()
    expect(toMoney('   ')).toBeNaN()
  })

  it('refuses half-typed garbage', () => {
    expect(toMoney('1e')).toBeNaN()
    expect(toMoney('-')).toBeNaN()
  })
})

describe('workCatalogueItemSchema', () => {
  it('rejects a blank price with the figure named', () => {
    const result = workCatalogueItemSchema.safeParse(values({ clientPrice: toMoney('') }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Cena j.m. musi być liczbą')
  })

  it('rejects a negative stawka', () => {
    const result = workCatalogueItemSchema.safeParse(values({ wToolsRate: -1 }))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Stawka z narzędziami nie może być ujemna')
  })

  it('accepts a zero stawka — a praca the company does not subcontract', () => {
    expect(workCatalogueItemSchema.safeParse(values({ ownToolsRate: 0 })).success).toBe(true)
  })
})
