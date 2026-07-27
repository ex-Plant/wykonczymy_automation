import { describe, expect, it } from 'vitest'
import {
  overrideSnapshot,
  priceKeystroke,
  priceSettle,
} from '@/lib/kosztorys/subcontractor-price-edit'
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

const flat = (value: number): ViewPricingT => ({
  ...row,
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: value,
})

describe('priceKeystroke', () => {
  it('nie zapisuje nic po wyczyszczeniu pola', () => {
    // The bug this guards: writing `type: null` here swapped the input for read-only text mid-edit,
    // killing the caret and restoring the old price.
    expect(priceKeystroke('', flat(70), 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('trzyma niedokończony wpis zamiast go odrzucać', () => {
    expect(priceKeystroke('1e', flat(70), 'w_tools')).toEqual({ kind: 'hold' })
  })

  it('wpisana cena przestawia „auto" na kwotę stałą', () => {
    expect(priceKeystroke('50', row, 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 50 },
    })
  })

  it('wpisana cena kasuje własny mnożnik — zostaje kwota stała', () => {
    const coeffRow: ViewPricingT = {
      ...row,
      wToolsOverrideType: 'coeff',
      wToolsOverrideValue: 0.6,
    }
    expect(priceKeystroke('75', coeffRow, 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 75 },
    })
  })

  it('przyjmuje przecinek jako separator dziesiętny', () => {
    expect(priceKeystroke('50,5', flat(70), 'w_tools')).toMatchObject({
      kind: 'commit',
      row: { wToolsOverrideValue: 50.5 },
    })
  })

  it('zapisuje cenę powyżej stawki z mnożnika — to tylko ostrzeżenie', () => {
    expect(priceKeystroke('70', flat(50), 'w_tools').kind).toBe('commit')
  })

  it('blokuje cenę powyżej sufitu', () => {
    expect(priceKeystroke('81', flat(70), 'w_tools').kind).toBe('blocked')
  })

  it('pisze do pól planu, w którym edytujemy', () => {
    expect(priceKeystroke('30', flat(70), 'own_tools')).toMatchObject({
      kind: 'commit',
      row: { ownToolsOverrideType: 'amount', ownToolsOverrideValue: 30, wToolsOverrideValue: 70 },
    })
  })
})

describe('priceSettle', () => {
  const entry = overrideSnapshot(flat(70), 'w_tools')

  it('puste pole wraca do „auto" dopiero po wyjściu z komórki', () => {
    expect(priceSettle('', flat(70), 'w_tools', entry)).toMatchObject({
      kind: 'clear',
      row: { wToolsOverrideType: null, wToolsOverrideValue: 0 },
    })
  })

  it('przyjęta wartość nie wymaga dopisku — wiersz już ją ma', () => {
    expect(priceSettle('70', flat(70), 'w_tools', entry)).toEqual({ kind: 'keep' })
  })

  it('odrzucona wartość cofa wiersz do stanu sprzed edycji', () => {
    // Typing „2344000" commits the prefixes 2, 23, 234 … until one breaches the ceiling. Walking
    // away used to leave 234 standing — a price the user never chose.
    expect(priceSettle('2344000', flat(234), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: { wToolsOverrideType: 'amount', wToolsOverrideValue: 70 },
    })
  })

  it('podaje przywróconą cenę, żeby dało się ją ogłosić', () => {
    expect(priceSettle('2344000', flat(234), 'w_tools', entry)).toMatchObject({
      restoredPrice: 70,
    })
  })

  it('niedokończony wpis cofa się bez ogłaszania', () => {
    expect(priceSettle('1e', flat(1), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'invalid',
      row: { wToolsOverrideValue: 70 },
    })
  })

  it('cofnięcie do stanu, w którym wiersz już jest, nic nie zapisuje — ale nadal jest odrzuceniem', () => {
    expect(priceSettle('81', flat(70), 'w_tools', entry)).toMatchObject({
      kind: 'rollback',
      reason: 'blocked',
      row: null,
      restoredPrice: 70,
    })
  })
})
