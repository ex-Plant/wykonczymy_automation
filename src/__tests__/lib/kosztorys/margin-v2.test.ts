import { describe, expect, it } from 'vitest'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { marginV2 } from '@/lib/kosztorys/margin-v2'
import { ZERO_FINANCIALS, type InvestmentFinancialsT } from '@/types/investment-financials'

const financials: InvestmentFinancialsT = {
  ...ZERO_FINANCIALS,
  totalLaborCosts: 1000,
  totalDiscount: 100,
  totalPayouts: 700,
  totalLoss: 50,
  totalSettled: 30,
  materialsNetDiscount: 20,
}

const settled = { due: 600, hasUnconfirmedPlane: false }

describe('marginV2', () => {
  it('robocizna minus rabat, należne podwykonawcom, materiał wliczony w robociznę i strata', () => {
    expect(marginV2(financials, settled)).toBe(220) // 1000 − 100 − 600 − 30 − 50
  })

  it('nie odejmuje obniżki materiałów', () => {
    const richer = { ...financials, materialsNetDiscount: 999 }
    expect(marginV2(richer, settled)).toBe(marginV2(financials, settled))
  })

  it('nie odejmuje wypłat — należne podwykonawcom zastępuje je, nie uzupełnia', () => {
    const paidNothing = { ...financials, totalPayouts: 0 }
    expect(marginV2(paidNothing, settled)).toBe(marginV2(financials, settled))
  })

  it('to inna figura niż stara marża, na tych samych danych', () => {
    expect(calculateMargin(financials)).toBe(100) // 1000 − 700 − 100 − 50 − 30 − 20
    expect(marginV2(financials, settled)).not.toBe(calculateMargin(financials))
  })

  // Rozstrzygnięcie właściciela (2026-08-18): etap z wykonaną pracą i bez wybranego sposobu
  // rozliczenia wstrzymuje figurę. Zero twierdziłoby, że praca nic nie kosztowała.
  it('etap bez sposobu rozliczenia wstrzymuje figurę', () => {
    expect(marginV2(financials, { due: 600, hasUnconfirmedPlane: true })).toBeNull()
  })

  it('wstrzymuje niezależnie od tego, ile już naliczono', () => {
    expect(marginV2(financials, { due: 0, hasUnconfirmedPlane: true })).toBeNull()
  })

  it('pusta inwestycja to zero, nie null', () => {
    expect(marginV2(ZERO_FINANCIALS, { due: 0, hasUnconfirmedPlane: false })).toBe(0)
  })

  it('należne ponad robociznę daje ujemną marżę', () => {
    expect(marginV2(financials, { due: 1500, hasUnconfirmedPlane: false })).toBe(-680)
  })
})
