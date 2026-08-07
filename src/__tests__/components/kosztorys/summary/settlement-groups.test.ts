import { describe, expect, it } from 'vitest'
import { buildSettlementGroups } from '@/components/kosztorys/summary/settlement-groups'
import { computeMixedSettlement } from '@/lib/kosztorys/summary-economics'

const rowNamed = (groups: ReturnType<typeof buildSettlementGroups>, label: string) =>
  groups.flatMap((group) => group.rows).find((row) => row.label === label)

describe('buildSettlementGroups — the non-mixed tryby', () => {
  it('renders one caption-less tor: wpłaty, then the debt on both planes', () => {
    const groups = buildSettlementGroups({
      mixed: null,
      doZaplaty: { net: 1000, gross: 1230 },
      wplatyNet: 300,
      vatRate: 0.23,
      filtersActive: false,
    })
    expect(groups).toHaveLength(1)
    expect(groups[0]?.caption).toBeUndefined()
    expect(groups[0]?.rows.map((row) => row.label)).toEqual([
      'Wpłaty',
      'Do zapłaty netto',
      'Do zapłaty brutto',
    ])
    // Wpłaty are a deduction step: a positive figure in a subtracted row reads as an addition.
    expect(rowNamed(groups, 'Wpłaty')?.amount).toBe(-300)
  })

  // The two axes straddle zero independently — netto subtracts wpłaty at face value while brutto
  // grosses the debt — so each row's alarm tone must come from its own amount. Keyed off the wrong
  // axis, a real outstanding brutto debt renders un-alarmed on a slightly overpaid netto.
  it('tones each „Do zapłaty" from its own figure when the axes differ in sign', () => {
    const groups = buildSettlementGroups({
      mixed: null,
      doZaplaty: { net: -100, gross: 130 },
      wplatyNet: 1100,
      vatRate: 0.23,
      filtersActive: false,
    })
    expect(rowNamed(groups, 'Do zapłaty netto')?.danger).toBe(false)
    expect(rowNamed(groups, 'Do zapłaty brutto')?.danger).toBe(true)
  })
})

describe('buildSettlementGroups — tryb mieszany', () => {
  it('splits into the cash tor and the faktura tor, each closing on its own plane', () => {
    const mixed = computeMixedSettlement(1000, { grossBase: 0, netBilled: 0 }, 0.23, 400, 123, null)
    const groups = buildSettlementGroups({
      mixed,
      doZaplaty: { net: 0, gross: 0 },
      wplatyNet: 0,
      vatRate: 0.23,
      filtersActive: false,
    })
    expect(groups.map((group) => group.caption)).toEqual([
      'Rozliczenie netto',
      'Rozliczenie fakturą',
    ])
    // A wpłata belongs to the tor it was made on — that is what the split exists to keep true.
    expect(rowNamed(groups, 'Wpłaty netto')?.amount).toBe(-400)
    expect(rowNamed(groups, 'Wpłaty brutto')?.amount).toBe(-123)
    expect(rowNamed(groups, 'Pozostało netto')?.amount).toBeCloseTo(600)
    expect(rowNamed(groups, 'Pozostało brutto')?.amount).toBeCloseTo(738)
  })
})
