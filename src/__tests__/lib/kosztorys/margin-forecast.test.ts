import { describe, expect, it } from 'vitest'
import { marginForecast } from '@/lib/kosztorys/margin-forecast'
import type { ViewPricingT } from '@/lib/kosztorys/types'

// Przedmiar 10 × 20 zł = 200 zł po stronie inwestora. Podwykonawca ma wpisane na sztywno dwie różne
// kwoty — 12 z narzędziami, 10 bez — bo scenariusz ma je rozróżniać.
const item: ViewPricingT = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 10,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: 20,
  wToolsOverrideType: 'amount',
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount',
  ownToolsOverrideValue: 10,
  note: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
}

describe('marginForecast', () => {
  it('wycenia przedmiar po obu stronach i zwraca różnicę', () => {
    expect(marginForecast([item], 'w_tools')).toEqual({
      clientNet: 200,
      subcontractorNet: 120,
      margin: 80,
    })
  })

  it('scenariusz zmienia wyłącznie stronę podwykonawcy', () => {
    const own = marginForecast([item], 'own_tools')
    expect(own.clientNet).toBe(200)
    expect(own.subcontractorNet).toBe(100)
    expect(own.margin).toBe(100)
  })

  it('stawka ze współczynnika idzie za scenariuszem tak samo jak wpisana ręcznie', () => {
    const derived: ViewPricingT = {
      ...item,
      wToolsOverrideType: null,
      ownToolsOverrideType: null,
    }
    expect(marginForecast([derived], 'w_tools').subcontractorNet).toBe(130) // 10 × 20 × 0.65
    expect(marginForecast([derived], 'own_tools').subcontractorNet).toBe(110) // 10 × 20 × 0.55
  })

  // Rozstrzygnięcie właściciela (2026-08-18): rabatu nie daje się z góry, więc prognoza liczy się
  // z przedmiaru po pełnej cenie. Gdyby przechodziła przez rowPlannedNetForView, rabat obciąłby
  // wyłącznie stronę inwestora — prognoza urosłaby dokładnie o rabat.
  it('rabat procentowy nie rusza prognozy', () => {
    const discounted = { ...item, discountType: 'percent' as const, discountValue: 10 }
    expect(marginForecast([discounted], 'w_tools')).toEqual(marginForecast([item], 'w_tools'))
  })

  it('rabat kwotowy nie rusza prognozy', () => {
    const discounted = { ...item, discountType: 'amount' as const, discountValue: 30 }
    expect(marginForecast([discounted], 'w_tools')).toEqual(marginForecast([item], 'w_tools'))
  })

  it('rabat globalny nie rusza prognozy', () => {
    const global = { ...item, globalDiscountActive: true }
    expect(marginForecast([global], 'w_tools')).toEqual(marginForecast([item], 'w_tools'))
  })

  it('sumuje pozycje', () => {
    const second = { ...item, id: 2, plannedQty: 5, clientPrice: 40 }
    const both = marginForecast([item, second], 'w_tools')
    expect(both.clientNet).toBe(400) // 200 + 5 × 40
    expect(both.subcontractorNet).toBe(180) // 120 + 5 × 12
    expect(both.margin).toBe(220)
  })

  it('pusty kosztorys to zera, nie NaN', () => {
    expect(marginForecast([], 'w_tools')).toEqual({
      clientNet: 0,
      subcontractorNet: 0,
      margin: 0,
    })
  })

  // „Ilości nie bywają ujemne" — pozycja bez przedmiaru nie może wnosić ujemnej kwoty do prognozy.
  it('pozycja bez przedmiaru nic nie wnosi', () => {
    const empty = { ...item, plannedQty: 0 }
    expect(marginForecast([empty], 'w_tools')).toEqual({
      clientNet: 0,
      subcontractorNet: 0,
      margin: 0,
    })
  })

  // Wysoki rabat zjada marżę „po kursie" ceny pełnej — ale to figura marży rzeczywistej, nie
  // prognozy. Tu utrwalamy, że prognoza może zejść na minus wyłącznie przez samą stawkę.
  it('stawka podwykonawcy powyżej ceny inwestora daje ujemną prognozę', () => {
    const overpriced = { ...item, wToolsOverrideValue: 25 }
    expect(marginForecast([overpriced], 'w_tools').margin).toBe(-50) // 200 − 250
  })
})
