import { describe, it, expect, vi } from 'vitest'

// server-only throws at import time outside Next.js — stub it out
vi.mock('server-only', () => ({}))

import { shapeInvestments } from '@/lib/queries/shape-investments'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentFinancialsMapT, KosztorysClientTotalsMapT } from '@/lib/queries/balances'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'

const baseInv: InvestmentRefT = {
  id: 5,
  name: 'Grojecka',
  status: 'active',
  address: 'Grójecka 1',
  phone: '123',
  email: 'g@x.pl',
  contactPerson: 'Pan G',
  notes: '',
  review: '',
  hasSheet: false,
  materialsNetRate: null,
  settlementMode: 'NET',
  vatRate: DEFAULT_VAT,
  active: true,
}

describe('shapeInvestments', () => {
  it('computes balance and margin from financials', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [],
        totalMaterialCosts: 1000,
        materialsGrossBase: 1000,
        materialsNetBilled: 0,
        totalIncome: 9547,
        totalLaborCosts: 3900,
        totalPayouts: 1000,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
        netCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments([baseInv], financials)
    expect(row.totalCosts).toBe(4900) // 1000 + 3900
    expect(row.balance).toBe(4647) // 9547 - (1000 + 3900)
    expect(row.margin).toBe(2900) // 3900 - 1000
    expect(row).toMatchObject({ id: 5, name: 'Grojecka', status: 'active', hasSheet: false })
  })

  it('defaults to zeroed financials when investment has no entry', () => {
    const [row] = shapeInvestments([baseInv], {})
    expect(row).toMatchObject({
      totalCosts: 0,
      totalMaterialCosts: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      totalInvestmentExpense: 0,
      categoryCosts: [],
      balance: 0,
      margin: 0,
    })
  })

  // Material booked to no category is legacy — three investments carry it and no column shows it.
  // It still belongs INSIDE „Wydatki inwestycyjne", or the total would understate what was spent.
  it('folds material with no category into the total', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [
          { categoryId: 1, total: 800 },
          { categoryId: 2, total: 400 },
        ],
        totalMaterialCosts: 1150, // (800 + 400) + (-50) uncategorised
        materialsGrossBase: 1150,
        materialsNetBilled: 0,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
        netCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments([baseInv], financials)
    expect(row.totalInvestmentExpense).toBe(1150)
    expect(row.categoryCosts).toEqual([
      { categoryId: 1, total: 800 },
      { categoryId: 2, total: 400 },
    ])
  })

  it('prices each category on the plane it was recorded on when a rate is set', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        // Category 1 mixes planes: 1150 brutto receipts + 100 already billed netto.
        categoryCosts: [{ categoryId: 1, total: 1250 }],
        netCategoryCosts: [{ categoryId: 1, total: 100 }],
        totalMaterialCosts: 1250,
        materialsGrossBase: 1150,
        materialsNetBilled: 100,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 230,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments([{ ...baseInv, materialsNetRate: 0.25 }], financials)
    // 1150 ÷ 1,25 = 920, plus the 100 netto at face value — the netto part is NOT divided again.
    expect(row.categoryCosts).toEqual([{ categoryId: 1, total: 1020 }])
    expect(row.totalInvestmentExpense).toBe(1020)
  })

  it('leaves the saved rate inert under rozliczenie brutto', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [{ categoryId: 1, total: 1250 }],
        netCategoryCosts: [{ categoryId: 1, total: 100 }],
        totalMaterialCosts: 1250,
        materialsGrossBase: 1150,
        materialsNetBilled: 100,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments(
      [{ ...baseInv, materialsNetRate: 0.25, settlementMode: 'GROSS' }],
      financials,
    )
    expect(row.categoryCosts).toEqual([{ categoryId: 1, total: 1250 }])
    expect(row.totalInvestmentExpense).toBe(1250)
  })

  it('grosses the bilans on the prace alone and passes the settled spend through', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [],
        netCategoryCosts: [],
        totalMaterialCosts: 1000,
        materialsGrossBase: 1000,
        materialsNetBilled: 0,
        totalIncome: 9547,
        totalLaborCosts: 3900,
        totalPayouts: 0,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 250,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments([{ ...baseInv, vatRate: 0.23 }], financials)
    expect(row.totalSettled).toBe(250)
    // VAT is another charge on the client, so it DEDUCTS from a balance where negative = owed.
    // The 1000 materiały are not grossed.
    expect(row.balanceGross).toBeCloseTo(row.balance - 897, 10)
  })

  it('grosses the prace net of the rabat, not the raw labour', () => {
    const [row] = shapeInvestments([{ ...baseInv, vatRate: 0.05 }], {
      '5': {
        categoryCosts: [],
        netCategoryCosts: [],
        totalMaterialCosts: 0,
        materialsGrossBase: 0,
        materialsNetBilled: 0,
        totalIncome: 0,
        totalLaborCosts: 270951,
        totalPayouts: 0,
        totalRabat: 100000,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
      },
    })
    // The client never pays VAT on money they were discounted: 5% × (270951 − 100000).
    expect(row.balanceGross).toBeCloseTo(row.balance - 8547.55, 8)
  })

  it('falls back to the default VAT when the investment carries none', () => {
    // The read applies DEFAULT_VAT to a null vat_rate, so a row can never gross to NaN here.
    const [row] = shapeInvestments([baseInv], {
      '5': {
        categoryCosts: [],
        netCategoryCosts: [],
        totalMaterialCosts: 0,
        materialsGrossBase: 0,
        materialsNetBilled: 0,
        totalIncome: 0,
        totalLaborCosts: 1000,
        totalPayouts: 0,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 0,
        settledCategoryCosts: [],
      },
    })
    expect(row.balanceGross).toBeCloseTo(row.balance - DEFAULT_VAT * 1000, 10)
  })

  it('keeps material with no category inside wydatki inwestycyjne', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [
          { categoryId: 1, total: 1250 },
          { categoryId: 2, total: 500 },
        ],
        netCategoryCosts: [{ categoryId: 1, total: 100 }],
        totalMaterialCosts: 1990, // the two categories plus a 240 uncategorised correction
        materialsGrossBase: 1890,
        materialsNetBilled: 100,
        totalIncome: 0,
        totalLaborCosts: 0,
        totalPayouts: 0,
        totalRabat: 0,
        totalLoss: 0,
        totalSettled: 0,
        materialsNetDiscount: 378,
        settledCategoryCosts: [],
      },
    }
    const [row] = shapeInvestments([{ ...baseInv, materialsNetRate: 0.25 }], financials)
    // Absolute figures first — the Σ identity alone is satisfied by any wrong pair, because the
    // korekta is DERIVED as total − Σ columns and would silently absorb a mispriced column.
    expect(row.totalInvestmentExpense).toBeCloseTo(1612, 10) // 1890/1.25 + 100
    expect(row.categoryCosts).toEqual([
      { categoryId: 1, total: 1020 }, // (1250 − 100)/1.25 + 100
      { categoryId: 2, total: 400 }, // 500/1.25
    ])
    // 1612 − (1020 + 400): the 192 with no category is inside the total and shown by no column.
    const columnSum = row.categoryCosts.reduce((sum, c) => sum + c.total, 0)
    expect(row.totalInvestmentExpense - columnSum).toBeCloseTo(192, 10)
  })
})

// The read-switch (EX-555): robocizna and rabat come from the kosztorys wherever there is one. The
// figures below are chosen so the two planes DISAGREE — a switch that silently kept reading
// transactions would still produce plausible numbers, just the old ones.
describe('shapeInvestments read-switch', () => {
  const transactionFinancials: InvestmentFinancialsMapT = {
    '5': {
      categoryCosts: [],
      netCategoryCosts: [],
      totalMaterialCosts: 1000,
      materialsGrossBase: 1000,
      materialsNetBilled: 0,
      totalIncome: 9547,
      totalLaborCosts: 3900,
      totalPayouts: 1000,
      totalRabat: 0,
      totalLoss: 0,
      totalSettled: 0,
      materialsNetDiscount: 0,
      settledCategoryCosts: [],
    },
  }

  const kosztorysTotals: KosztorysClientTotalsMapT = {
    '5': { doneNet: 4500, sumaPracNet: 5000, rabatClientNet: 500, globalRabatNet: 0 },
  }

  it('builds bilans, marża and koszty from the kosztorys pair', () => {
    const [row] = shapeInvestments([baseInv], transactionFinancials, kosztorysTotals)

    expect(row.totalLaborCosts).toBe(5000)
    expect(row.totalCosts).toBe(6000) // 1000 materiały + 5000 robocizny z kosztorysu
    expect(row.balance).toBe(4047) // 9547 − 6000 + 500 rabatu
    expect(row.margin).toBe(3500) // 5000 − 1000 wypłat − 500 rabatu
  })

  it('grosses the bilans on the kosztorys pair, not the transactions one', () => {
    // The whole point of the switched VAT base: 3900 would produce a brutto figure that is not the
    // netto one plus its tax.
    const [row] = shapeInvestments(
      [{ ...baseInv, vatRate: 0.23 }],
      transactionFinancials,
      kosztorysTotals,
    )

    expect(row.balanceGross).toBeCloseTo(row.balance - 0.23 * 4500, 10)
  })

  it('leaves an investment with no kosztorys byte-identical to the pre-switch output', () => {
    // The regression guard for the 84 of 96 investments that have no kosztorys and must not move.
    const [before] = shapeInvestments([baseInv], transactionFinancials)
    const [after] = shapeInvestments([baseInv], transactionFinancials, {})
    const [absentFromMap] = shapeInvestments([baseInv], transactionFinancials, kosztorysTotals)

    expect(after).toEqual(before)
    expect(after.totalLaborCosts).toBe(3900)
    // Same map, different investment: the lookup must key on the id, not merely on the map existing.
    expect(shapeInvestments([{ ...baseInv, id: 6 }], {}, kosztorysTotals)[0].totalLaborCosts).toBe(0)
    expect(absentFromMap.totalLaborCosts).toBe(5000)
  })

  it('reads a zero-progress kosztorys as zero robocizny, not as a fallback', () => {
    // An investment whose kosztorys exists but has nothing executed yet is on the kosztorys plane.
    // Falling back here would surface its legacy LABOR_COST rows as if they were current.
    const [row] = shapeInvestments([baseInv], transactionFinancials, {
      '5': { doneNet: 0, sumaPracNet: 0, rabatClientNet: 0, globalRabatNet: 0 },
    })

    expect(row.totalLaborCosts).toBe(0)
    expect(row.margin).toBe(-1000) // same wypłaty, no robocizna to cover them
  })
})
