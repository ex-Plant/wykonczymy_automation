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
      taggedNet: { total: 0, count: 0 },
      taggedGross: { total: 0, count: 0 },
    })
  })

  // The tagged tallies count ONLY what was actually typed — an unmarked deposit lands in paidNet by
  // the settlement ruling but must leave taggedNet at zero, or the plane warning reads "untagged" as
  // "contradicts the mode".
  it('tagged tallies exclude unmarked deposits', () => {
    const b = bucketDepositsByPlane([
      deposit(100, 'NET'),
      deposit(400, null),
      deposit(200, 'GROSS'),
    ])
    expect(b.paidNet).toBe(500)
    expect(b.taggedNet).toEqual({ total: 100, count: 1 })
    expect(b.taggedGross).toEqual({ total: 200, count: 1 })
  })
})
