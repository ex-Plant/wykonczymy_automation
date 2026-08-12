import { describe, expect, it } from 'vitest'
import { buildSettlementGroups } from '@/components/kosztorys/summary/settlement-groups'
import { computeMixedSettlement } from '@/lib/kosztorys/summary-economics'

const rowNamed = (groups: ReturnType<typeof buildSettlementGroups>, label: string) =>
  groups.flatMap((group) => group.rows).find((row) => row.label === label)

describe('buildSettlementGroups — the non-mixed tryby', () => {
  it('one two-column table: wpłaty spanning both tracks, then „Pozostało do zapłaty"', () => {
    const groups = buildSettlementGroups({
      mixed: null,
      doZaplaty: { net: 1000, gross: 1230 },
      depositsNet: 300,
      vatRate: 0.23,
    })
    expect(groups.map((group) => group.axis)).toEqual(['both'])
    expect(groups[0]?.caption).toBeUndefined()
    expect(groups[0]?.rows.map((row) => row.label)).toEqual(['Wpłaty', 'Pozostało do zapłaty'])
    // ONE debt quoted on two planes, not two debts — so one row across two columns, never a row each.
    expect(rowNamed(groups, 'Pozostało do zapłaty')?.line).toEqual({ net: 1000, gross: 1230 })
    // Wpłaty carry no VAT: one merged cell, not a netto/brutto pair that happens to match.
    expect(rowNamed(groups, 'Wpłaty')?.span).toBe(true)
    // A deduction step: a positive figure in a subtracted row reads as an addition.
    expect(rowNamed(groups, 'Wpłaty')?.line.net).toBe(-300)
  })

  // The two axes straddle zero independently — netto subtracts wpłaty at face value while brutto
  // grosses the debt — so the alarm resolves per CELL now that both share a row. Keyed off one axis,
  // a real outstanding brutto debt renders un-alarmed beside a slightly overpaid netto.
  it('tones each column of „Do zapłaty" from its own figure when the axes differ in sign', () => {
    const groups = buildSettlementGroups({
      mixed: null,
      doZaplaty: { net: -100, gross: 130 },
      depositsNet: 1100,
      vatRate: 0.23,
    })
    expect(rowNamed(groups, 'Pozostało do zapłaty')?.danger).toEqual({ net: false, gross: true })
  })

  // Materiały are a term of Łącznie in the Podsumowanie table above, not a settlement step — printing
  // them here too would charge them twice on the way down to the debt.
  it('carries no materiały step', () => {
    const groups = buildSettlementGroups({
      mixed: null,
      doZaplaty: { net: 1000, gross: 1230 },
      depositsNet: 300,
      vatRate: 0.23,
    })
    expect(rowNamed(groups, 'Materiały')).toBeUndefined()
  })
})

describe('buildSettlementGroups — tryb mieszany', () => {
  it('splits into the cash tor and the faktura tor, each closing on its own plane', () => {
    const mixed = computeMixedSettlement(1000, { grossBase: 0, netBilled: 0 }, 0.23, 400, 123, null)
    const groups = buildSettlementGroups({
      mixed,
      doZaplaty: { net: 0, gross: 0 },
      depositsNet: 0,
      vatRate: 0.23,
    })
    expect(groups.map((group) => group.caption)).toEqual([
      'Rozliczenie netto',
      'Rozliczenie fakturą',
    ])
    // A wpłata belongs to the tor it was made on — that is what the split exists to keep true.
    expect(rowNamed(groups, 'Wpłaty netto')?.line.net).toBe(-400)
    expect(rowNamed(groups, 'Wpłaty brutto')?.line.net).toBe(-123)
    expect(rowNamed(groups, 'Pozostało netto')?.line.net).toBeCloseTo(600)
    // Łącznie brutto 1230 less the 400 wpłaty netto — the wpłata comes off after the gross-up, not before.
    expect(rowNamed(groups, 'Pozostało brutto')?.line.net).toBeCloseTo(830)
    // Each tor settles on one plane, so neither may claim the two-column layout.
    expect(groups.map((group) => group.axis)).toEqual(['net', 'net'])
    // Both tory open with their wpłaty, so the two read the same way down the page.
    expect(groups[1]?.rows.map((row) => row.label)).toEqual([
      'Wpłaty brutto',
      'Pozostało brutto',
      'Do zapłaty brutto',
    ])
  })

  // „Do zapłaty netto" is the same debt read back without a faktura, not a second one owed on top of
  // the brutto close — and it deducts the faktura tor's wpłaty, which the netto table doesn't show.
  // Alarmed like its twin it reads as two debts, so only the faktura close carries the tone.
  it('alarms the faktura close but not its netto counterpart', () => {
    const mixed = computeMixedSettlement(1000, { grossBase: 0, netBilled: 0 }, 0.23, 0, 0, null)
    const groups = buildSettlementGroups({
      mixed,
      doZaplaty: { net: 0, gross: 0 },
      depositsNet: 0,
      vatRate: 0.23,
    })
    expect(mixed.doZaplatyNet).toBeGreaterThan(0)
    expect(rowNamed(groups, 'Do zapłaty netto')?.danger).toBeUndefined()
    expect(rowNamed(groups, 'Do zapłaty brutto')?.danger).toBe(true)
  })

  // Materiały are a term of Łącznie in the Podsumowanie table above; the netto tor starts from that
  // Łącznie and the faktura tor from a reszta that already carries it, so neither restates the charge.
  it('carries no materiały step on either tor', () => {
    const mixed = computeMixedSettlement(
      1000,
      { grossBase: 500, netBilled: 0 },
      0.23,
      400,
      123,
      null,
    )
    const groups = buildSettlementGroups({
      mixed,
      doZaplaty: { net: 0, gross: 0 },
      depositsNet: 0,
      vatRate: 0.23,
    })
    expect(rowNamed(groups, 'Materiały')).toBeUndefined()
  })
})
