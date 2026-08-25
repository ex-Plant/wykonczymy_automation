import { describe, expect, it } from 'vitest'
import { sumCosts, summariseCosts } from '@/lib/fleet/costs'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { ALL_TIME } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/types/fleet'

let nextId = 1

const entry = (performedAt: string, cost: number | null): InspectionHistoryEntryT => ({
  id: nextId++,
  type: 'TECHNICAL',
  performedAt,
  nextDueAt: null,
  odometer: null,
  nextDueOdometer: null,
  cost,
  insurer: '',
  policyNumber: '',
  note: '',
  attachmentCount: 0,
  kmSincePrevious: null,
})

const history = (
  overrides: Partial<Record<InspectionTypeT, InspectionHistoryEntryT[]>>,
): Record<InspectionTypeT, InspectionHistoryEntryT[]> =>
  Object.fromEntries(INSPECTION_TYPES.map((type) => [type, overrides[type] ?? []])) as Record<
    InspectionTypeT,
    InspectionHistoryEntryT[]
  >

describe('summariseCosts', () => {
  it('totals per type and overall', () => {
    const costs = summariseCosts(
      history({
        TECHNICAL: [entry('2026-01-01', 200), entry('2025-01-01', 300)],
        TYRES: [entry('2026-02-01', 500)],
      }),
    )

    expect(costs.byType).toEqual([
      { type: 'TECHNICAL', count: 2, total: 500 },
      { type: 'TYRES', count: 1, total: 500 },
    ])
    expect(costs.total).toBe(1000)
  })

  // „We have never done this" is not the claim „it was free" — the successor to the old rule about
  // priceless entries, which a required „Koszt" made unreachable.
  it('leaves out a type with no inspection at all', () => {
    const costs = summariseCosts(history({ TECHNICAL: [entry('2026-01-01', 200)] }))

    expect(costs.byType.map((bucket) => bucket.type)).toEqual(['TECHNICAL'])
    expect(costs.entries).toHaveLength(1)
  })

  // A free service is a real answer and must survive into the breakdown, not be mistaken for none.
  it('keeps a zero-cost inspection', () => {
    const costs = summariseCosts(history({ TECHNICAL: [entry('2026-01-01', 0)] }))

    expect(costs.byType).toEqual([{ type: 'TECHNICAL', count: 1, total: 0 }])
    expect(costs.entries).toHaveLength(1)
  })

  // The przegląd happened; only its price is unknown. Dropping it from `count` would claim the car
  // has no history, and adding a zero to `total` would claim the visit was free.
  it('counts an unknown-cost inspection but keeps it out of the total', () => {
    const costs = summariseCosts(
      history({ TECHNICAL: [entry('2026-01-01', null), entry('2025-01-01', 300)] }),
    )

    expect(costs.byType).toEqual([{ type: 'TECHNICAL', count: 2, total: 300 }])
    expect(costs.total).toBe(300)
    expect(costs.entries).toHaveLength(2)
  })

  it('lists the entries newest first, across types', () => {
    const costs = summariseCosts(
      history({
        TECHNICAL: [entry('2026-01-01', 200)],
        TYRES: [entry('2026-06-01', 500), entry('2025-06-01', 100)],
      }),
    )

    expect(costs.entries.map((row) => row.performedAt)).toEqual([
      '2026-06-01',
      '2026-01-01',
      '2025-06-01',
    ])
  })

  it('is empty when the car has no history', () => {
    expect(summariseCosts(history({}))).toEqual({ byType: [], total: 0, entries: [] })
  })
})

describe('sumCosts', () => {
  const july = [
    { performedAt: '2026-06-30', cost: 1 },
    { performedAt: '2026-07-01', cost: 10 },
    { performedAt: '2026-07-15', cost: 100 },
    { performedAt: '2026-07-31', cost: 1000 },
    { performedAt: '2026-08-01', cost: 10_000 },
  ]

  it('counts everything without a window', () => {
    expect(sumCosts(july, ALL_TIME)).toBe(11_111)
  })

  it('includes both ends of the window', () => {
    expect(sumCosts(july, { from: '2026-07-01', to: '2026-07-31' })).toBe(1110)
  })

  it('runs to the present when only the start is given', () => {
    expect(sumCosts(july, { from: '2026-07-15' })).toBe(11_100)
  })

  it('runs from the beginning when only the end is given', () => {
    expect(sumCosts(july, { to: '2026-07-15' })).toBe(111)
  })

  // The listing hands over raw stored timestamps; comparing those as strings would drop the window's
  // last day, because any '2026-07-31T…' sorts after the bare '2026-07-31'.
  it('windows a stored timestamp by its Warsaw day', () => {
    const stored = [{ performedAt: '2026-07-31T00:00:00.000Z', cost: 500 }]

    expect(sumCosts(stored, { from: '2026-07-01', to: '2026-07-31' })).toBe(500)
  })

  // An unknown price is not a free one: coercing `null` to 0 would be invisible in the total, which
  // is exactly what makes it dangerous.
  it('skips the entries whose cost is unknown', () => {
    const mixed = [
      { performedAt: '2026-07-01', cost: null },
      { performedAt: '2026-07-02', cost: 250 },
    ]

    expect(sumCosts(mixed, ALL_TIME)).toBe(250)
    expect(sumCosts([{ performedAt: '2026-07-01', cost: null }], ALL_TIME)).toBe(0)
  })

  it('is zero when nothing falls inside', () => {
    expect(sumCosts(july, { from: '2027-01-01' })).toBe(0)
    expect(sumCosts([], ALL_TIME)).toBe(0)
  })
})
