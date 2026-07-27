import { describe, expect, it } from 'vitest'
import { priceExitEdit, priceKeystroke } from '@/lib/kosztorys/subcontractor-price-edit'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Client price 100 makes every threshold readable at a glance: ceiling 80, w_tools coefficient
// price 65.
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
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: 70,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  costVariant: null,
  hiddenInExport: false,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

describe('priceKeystroke', () => {
  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // The bug this guards: writing `type: null` here swapped the input for read-only text mid-edit,
    // killing the caret and restoring the old price.
    expect(priceKeystroke('', row, 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(priceKeystroke('1e', row, 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('zapisuje kwotę poniżej sufitu jako override „kwota stała"', () => {
    const result = priceKeystroke('50', row, 'w_tools')
    expect(result).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 50 },
    })
  })

  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(priceKeystroke('50,5', row, 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 50.5 },
    })
  })

  it('zapisuje kwotę powyżej stawki z mnożnika — to tylko ostrzeżenie', () => {
    expect(priceKeystroke('70', row, 'w_tools').kind).toBe('commit')
  })

  it('blokuje kwotę powyżej sufitu', () => {
    const result = priceKeystroke('81', row, 'w_tools')
    expect(result.kind).toBe('blocked')
  })

  it('pisze do pól planu, w którym edytujemy', () => {
    expect(priceKeystroke('30', row, 'own_tools')).toMatchObject({
      kind: 'commit',
      row: { ownToolsOverrideType: 'amount', ownToolsOverrideValue: 30, wToolsOverrideValue: 70 },
    })
  })
})

describe('priceExitEdit', () => {
  it('puste pole wraca do „auto" dopiero po wyjściu z komórki', () => {
    expect(priceExitEdit('', row, 'w_tools')).toMatchObject({
      wToolsOverrideType: null,
      wToolsOverrideValue: 0,
    })
  })

  it('nie rusza wiersza, gdy w polu coś zostało', () => {
    expect(priceExitEdit('70', row, 'w_tools')).toBeNull()
  })

  it('odrzucona wartość nie zapisuje się przy wyjściu — wiersz zostaje jak był', () => {
    expect(priceExitEdit('81', row, 'w_tools')).toBeNull()
  })
})
