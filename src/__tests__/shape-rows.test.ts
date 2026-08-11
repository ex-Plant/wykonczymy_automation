import { describe, it, expect, vi } from 'vitest'

// server-only throws at import time outside Next.js — stub it out
vi.mock('server-only', () => ({}))

import { shapeCashRegisters } from '@/lib/queries/cash-registers'
import { shapeInvestments } from '@/lib/queries/shape-investments'
import type { CashRegisterRefT, WorkerRefT, InvestmentRefT } from '@/types/reference-data'
import type { InvestmentFinancialsMapT } from '@/lib/queries/balances'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'

const workers: WorkerRefT[] = [{ id: 1, name: 'Adrian', role: 'MANAGER', email: 'a@x.pl' }]

const registers: CashRegisterRefT[] = [
  { id: 10, name: 'Kasa główna', type: 'MAIN', active: true, ownerId: 1 },
  { id: 11, name: 'Kasa bez właściciela', type: 'AUXILIARY' },
]

describe('shapeCashRegisters', () => {
  it('maps owner name, balance, and defaults', () => {
    const rows = shapeCashRegisters(registers, workers, { '10': 500 })
    expect(rows).toEqual([
      {
        id: 10,
        name: 'Kasa główna',
        ownerName: 'Adrian',
        balance: 500,
        type: 'MAIN',
        active: true,
      },
      {
        id: 11,
        name: 'Kasa bez właściciela',
        ownerName: '—',
        balance: 0,
        type: 'AUXILIARY',
        active: true,
      },
    ])
  })

  it('falls back to — when owner id has no matching worker', () => {
    const rows = shapeCashRegisters(
      [{ id: 12, name: 'Sierota', type: 'WORKER', active: false, ownerId: 999 }],
      workers,
      {},
    )
    expect(rows[0]).toMatchObject({ ownerName: '—', balance: 0, active: false })
  })
})

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

  // The uncategorised correction is part of what the investor is billed, so it belongs INSIDE
  // „Wydatki inwestycyjne" — it just has no category column of its own, hence its own field.
  it('folds the uncategorised correction into the total and carries it as its own figure', () => {
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
    expect(row.uncategorisedCorrection).toBe(-50)
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
    expect(row.uncategorisedCorrection).toBe(0)
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

  it('keeps Σ columns + korekta === wydatki inwestycyjne', () => {
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
    const columnSum = row.categoryCosts.reduce((sum, c) => sum + c.total, 0)
    expect(columnSum + row.uncategorisedCorrection).toBeCloseTo(row.totalInvestmentExpense, 10)
  })
})
