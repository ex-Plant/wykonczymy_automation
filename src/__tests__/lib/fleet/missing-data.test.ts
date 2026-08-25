import { describe, it, expect } from 'vitest'
import { findMissingInspections } from '@/lib/fleet/missing-data'
import { event, vehicle } from '@/__tests__/helpers/fleet'

describe('findMissingInspections', () => {
  // The hole the deadline logic structurally cannot see: no event means no nextDueAt, so no threshold
  // ever fires and the car stays silent forever.
  it('reports every type a vehicle has never had recorded', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle(), events: [event('TECHNICAL', '2026-01-01')] },
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

    expect(findMissingInspections([{ vehicle: vehicle(), events }])).toEqual([])
  })

  // A retired car has no deadlines worth chasing, and it would otherwise nag forever.
  it('ignores retired vehicles entirely', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle({ id: 2, status: 'RETIRED' }), events: [] },
    ])

    expect(missing).toEqual([])
  })

  // SERVICE is ad-hoc: there is no schedule it could be absent from.
  it('never reports Serwis, even for a vehicle with no events at all', () => {
    const missing = findMissingInspections([{ vehicle: vehicle(), events: [] }])

    expect(missing.map((entry) => entry.type)).toEqual([
      'TECHNICAL',
      'INSURANCE',
      'OIL_CHANGE',
      'WARRANTY',
      'TYRES',
    ])
  })

  // „Bezterminowo" in the sheet — the przyczepa's przegląd. Without this the weekly digest would nag
  // about an inspection that car can never have, forever.
  it('never reports a type the vehicle is exempt from', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle({ exemptions: ['TECHNICAL'] }), events: [] },
    ])

    expect(missing.map((entry) => entry.type)).toEqual([
      'INSURANCE',
      'OIL_CHANGE',
      'WARRANTY',
      'TYRES',
    ])
  })

  it('counts an event with no due date as recorded — the gap is data, not absence', () => {
    const missing = findMissingInspections([
      { vehicle: vehicle(), events: [event('TYRES', '2026-04-01', { nextDueAt: null })] },
    ])

    expect(missing.some((entry) => entry.type === 'TYRES')).toBe(false)
  })
})
