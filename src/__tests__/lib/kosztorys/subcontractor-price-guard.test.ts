import { describe, expect, it } from 'vitest'
import {
  MAX_CLIENT_SHARE,
  checkSubcontractorPrice,
  maxSubcontractorPrice,
} from '@/lib/kosztorys/subcontractor-price-guard'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Client price 100 makes every threshold readable at a glance: ceiling 80, w_tools coefficient
// price 65, own_tools 55.
const row: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  costVariant: null,
  hiddenInExport: false,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

const amount = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: value,
})

const coeff = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideType: 'coeff',
  wToolsOverrideValue: value,
})

describe('maxSubcontractorPrice', () => {
  it('to udział ceny klienta', () => {
    expect(maxSubcontractorPrice(row)).toBe(80)
    expect(MAX_CLIENT_SHARE).toBe(0.8)
  })
})

describe('checkSubcontractorPrice — sufit 80% ceny klienta', () => {
  // Sufit to drabina, nie bramka: dokładnie na 80% nie ma jeszcze błędu, ale skoro to wciąż
  // powyżej stawki mnożnika (65), zostaje ostrzeżenie.
  it('dokładnie na suficie nie jest błędem', () => {
    expect(checkSubcontractorPrice(amount(80), 'w_tools')?.severity).toBe('warning')
  })

  it('włos powyżej sufitu to błąd', () => {
    const issue = checkSubcontractorPrice(amount(80.02), 'w_tools')
    expect(issue?.severity).toBe('error')
    expect(issue?.message).toContain('80,00')
  })

  it('własny mnożnik powyżej sufitu to błąd', () => {
    expect(checkSubcontractorPrice(coeff(0.81), 'w_tools')?.severity).toBe('error')
    expect(checkSubcontractorPrice(coeff(0.8), 'w_tools')?.severity).toBe('warning')
  })
})

describe('checkSubcontractorPrice — ostrzeżenie powyżej stawki globalnego mnożnika', () => {
  it('dokładnie na stawce mnożnika nie ostrzega', () => {
    expect(checkSubcontractorPrice(amount(65), 'w_tools')).toBeNull()
  })

  it('powyżej stawki mnożnika, poniżej sufitu, ostrzega', () => {
    const issue = checkSubcontractorPrice(amount(70), 'w_tools')
    expect(issue?.severity).toBe('warning')
    expect(issue?.message).toContain('65,00')
  })

  it('poniżej stawki mnożnika milczy', () => {
    expect(checkSubcontractorPrice(amount(60), 'w_tools')).toBeNull()
  })

  // Cena z mnożnika bywa niedomknięta w groszach (0,333 × 100 = 33,3333…). Właściciel przepisuje
  // z ekranu zaokrągloną kwotę — bez tolerancji reszta zmiennoprzecinkowa zapalałaby bursztyn.
  it('kwota stała wpisana na zaokrągloną stawkę mnożnika nie ostrzega', () => {
    const oddCoeff = { ...amount(33.33), globalWToolsCoeff: 1 / 3 }
    expect(checkSubcontractorPrice(oddCoeff, 'w_tools')).toBeNull()
  })
})

describe('checkSubcontractorPrice — tryb auto', () => {
  it('nigdy nie ostrzega: cena JEST stawką mnożnika', () => {
    expect(checkSubcontractorPrice(row, 'w_tools')).toBeNull()
    expect(checkSubcontractorPrice(row, 'own_tools')).toBeNull()
  })

  it('błąd, gdy sam globalny mnożnik przekracza sufit', () => {
    const over = { ...row, globalWToolsCoeff: 0.9 }
    expect(checkSubcontractorPrice(over, 'w_tools')?.severity).toBe('error')
  })
})

describe('checkSubcontractorPrice — druga płaszczyzna narzędziowa', () => {
  const ownAmount = (value: number): ViewPricingT => ({
    ...row,
    ownToolsOverrideType: 'amount',
    ownToolsOverrideValue: value,
  })

  it('mierzy względem mnożnika własnej płaszczyzny', () => {
    // 60 jest poniżej mnożnika „z narzędziami" (0,65), ale powyżej „bez narzędzi" (0,55).
    expect(checkSubcontractorPrice(ownAmount(60), 'own_tools')?.severity).toBe('warning')
    expect(checkSubcontractorPrice(amount(60), 'w_tools')).toBeNull()
  })

  it('sufit jest ten sam na obu płaszczyznach', () => {
    expect(checkSubcontractorPrice(ownAmount(81), 'own_tools')?.severity).toBe('error')
  })
})

describe('checkSubcontractorPrice — brak ceny klienta', () => {
  it('milczy przy cenie 0 i ujemnej — nie ma marży do zmierzenia', () => {
    expect(checkSubcontractorPrice({ ...amount(50), clientPrice: 0 }, 'w_tools')).toBeNull()
    expect(checkSubcontractorPrice({ ...amount(50), clientPrice: -10 }, 'w_tools')).toBeNull()
  })
})
