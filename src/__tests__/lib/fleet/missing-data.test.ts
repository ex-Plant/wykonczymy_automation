import { describe, it, expect } from 'vitest'
import { findMissingInspections } from '@/lib/fleet/missing-data'
import type { VehicleSummaryT } from '@/lib/fleet/types'
import { event } from '@/__tests__/helpers/fleet'

const vehicle = (id: number, overrides: Partial<VehicleSummaryT> = {}): VehicleSummaryT => ({
  id,
  registration: `WX 0000${id}`,
  make: 'Ford',
  model: 'Transit',
  status: 'ACTIVE',
  ...overrides,
})

describe('findMissingInspections', () => {
  // The hole the deadline logic structurally cannot see: no event means no nextDueAt, so no threshold
  // ever fires and the car stays silent forever.
  it('reports every type a vehicle has never had recorded', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle(1), events: [event('TECHNICAL', '2026-01-01')] },
    ])

    expect(missing).toEqual([
      { vehicleId: 1, registration: 'WX 00001', type: 'INSURANCE' },
      { vehicleId: 1, registration: 'WX 00001', type: 'OIL_CHANGE' },
      { vehicleId: 1, registration: 'WX 00001', type: 'WARRANTY' },
      { vehicleId: 1, registration: 'WX 00001', type: 'TYRES' },
    ])
  })

  it('reports nothing for a fully covered vehicle', () => {
    const events = [
      event('TECHNICAL', '2026-01-01'),
      event('INSURANCE', '2026-01-01'),
      event('OIL_CHANGE', '2026-01-01'),
      event('WARRANTY', '2026-01-01'),
      event('TYRES', '2026-01-01'),
    ]

    expect(findMissingInspections([{ vehicle: vehicle(1), events }])).toEqual([])
  })

  // A retired car has no deadlines worth chasing, and it would otherwise nag forever.
  it('ignores retired vehicles entirely', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle(2, { status: 'RETIRED' }), events: [] },
    ])

    expect(missing).toEqual([])
  })

  it('counts an event with no due date as recorded — the gap is data, not absence', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle(1), events: [event('TYRES', '2026-04-01', { nextDueAt: null })] },
    ])

    expect(missing.some((entry) => entry.type === 'TYRES')).toBe(false)
  })
})
