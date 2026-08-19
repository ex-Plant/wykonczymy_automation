import { describe, expect, it } from 'vitest'
import { summariseCosts } from '@/lib/fleet/costs'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
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

  // A price nobody recorded is not a price of zero — the row would read as "it was free".
  it('leaves out a type whose entries carry no cost', () => {
    const costs = summariseCosts(
      history({ TECHNICAL: [entry('2026-01-01', 200)], TYRES: [entry('2026-02-01', null)] }),
    )

    expect(costs.byType.map((bucket) => bucket.type)).toEqual(['TECHNICAL'])
    expect(costs.entries).toHaveLength(1)
  })

  it('lists the costed entries newest first, across types', () => {
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

  it('is empty when nothing has a price', () => {
    const costs = summariseCosts(history({ TECHNICAL: [entry('2026-01-01', null)] }))

    expect(costs).toEqual({ byType: [], total: 0, entries: [] })
  })
})
