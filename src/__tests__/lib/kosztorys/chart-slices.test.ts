import { describe, expect, it } from 'vitest'
import { expensePieSlices } from '@/lib/kosztorys/chart-slices'
import { breakdownRowPair } from '@/lib/kosztorys/summary-economics'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

// The pie sits immediately beside the „Wydatki inwestycyjne" table, so its slices must add up to the
// „Razem" printed next to them. They fell apart once already: the table started crossing the rate per
// row while the pie kept reading the raw recorded figure, which on a netto-billed row is a whole rate
// short — two numbers for the same category, side by side.
describe('expensePieSlices vs the table it is drawn beside', () => {
  const rows: MaterialsBreakdownRowT[] = [
    { id: 1, label: 'Płytki', net: 12_300, origin: 'gross' },
    { id: 2, label: 'Farby', net: 1000, origin: 'netBilled' },
    { id: null, label: 'Korekta (bez kategorii)', net: -123, origin: 'gross' },
  ]

  const razem = (netRate: number | null) =>
    rows.reduce((sum, row) => sum + breakdownRowPair(row, netRate).gross, 0)

  it('sums to Razem at a saved rate, where the two row origins cross in opposite directions', () => {
    const total = expensePieSlices(rows, 0.23).reduce((sum, slice) => sum + slice.value, 0)
    expect(total).toBeCloseTo(razem(0.23))
    // The netto-billed row is the one that used to disagree — it must carry its grossed-up value.
    expect(expensePieSlices(rows, 0.23)[1]?.value).toBeCloseTo(1230)
  })

  it('sums to Razem with no rate saved, where nothing crosses', () => {
    const total = expensePieSlices(rows, null).reduce((sum, slice) => sum + slice.value, 0)
    expect(total).toBeCloseTo(razem(null))
  })
})
