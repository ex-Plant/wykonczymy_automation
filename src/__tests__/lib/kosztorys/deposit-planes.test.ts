import { describe, expect, it } from 'vitest'
import { bucketDepositsByPlane } from '@/lib/kosztorys/deposit-planes'
import type { DepositTransactionRowT } from '@/types/transfers'

const deposit = (amount: number, vatPlane: DepositTransactionRowT['vatPlane']) => ({
  amount,
  vatPlane,
})

// The netto/gross split of wpłaty that feeds the mixed-settlement gotówka target. The load-bearing
// rule is the owner's „brak wartości = netto": GROSS is the invoiced part, everything else (NET + null) is netto.
describe('bucketDepositsByPlane', () => {
  it('NET deposits bucket to paidNet, GROSS to paidGross', () => {
    const b = bucketDepositsByPlane([deposit(100, 'NET'), deposit(250, 'GROSS')])
    expect(b.paidNet).toBe(100)
    expect(b.paidGross).toBe(250)
  })

  it('a null (unmarked) deposit counts as NETTO, not brutto', () => {
    const b = bucketDepositsByPlane([deposit(100, 'GROSS'), deposit(400, null)])
    expect(b.paidNet).toBe(400)
    expect(b.paidGross).toBe(100)
  })

  it('all three states together: NET + null → paidNet, GROSS → paidGross', () => {
    const b = bucketDepositsByPlane([deposit(100, 'NET'), deposit(200, 'GROSS'), deposit(50, null)])
    expect(b.paidNet).toBe(150)
    expect(b.paidGross).toBe(200)
    // The two buckets always sum to the total wpłaty.
    expect(b.paidNet + b.paidGross).toBe(350)
  })

  it('empty list yields zeroed buckets', () => {
    const b = bucketDepositsByPlane([])
    expect(b).toEqual({
      paidNet: 0,
      paidGross: 0,
      total: 0,
    })
  })
})
