import { describe, expect, it } from 'vitest'
import { grossBalance } from '@/lib/db/gross-balance'

// GUARD (EX-675). A strata is face value on BOTH planes, so it may only reach the brutto reading
// through `balance` — never as a term of the VAT base. Append `- vatRate * totalLoss` (or fold the
// strata into the labour term) and the first test goes red: 1000 zł absorbed would forgive 1230 zł
// of brutto debt, and the company would eat the VAT on a cost it already ate once.
describe('grossBalance — a strata never widens the VAT base', () => {
  const labor = 10_000
  const balanceNoConcession = -labor

  it('shifts the brutto reading by exactly the złoty absorbed', () => {
    const withLoss = grossBalance(balanceNoConcession + 1000, 0.23, labor, 0)
    const without = grossBalance(balanceNoConcession, 0.23, labor, 0)

    expect(withLoss - without).toBeCloseTo(1000)
  })

  // The contrast that makes the rule visible: a rabat IS a concession on the price, so the złoty
  // it forgives never carried VAT and the brutto reading moves by 1.23×. A strata is not.
  it('unlike a rabat of the same size, which grosses', () => {
    const withDiscount = grossBalance(balanceNoConcession + 1000, 0.23, labor, 1000)
    const without = grossBalance(balanceNoConcession, 0.23, labor, 0)

    expect(withDiscount - without).toBeCloseTo(1230)
  })
})
