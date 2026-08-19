import { describe, it, expect } from 'vitest'
import { kmSinceOilChange, latestOdometerReading, resolveDeadlines } from '@/lib/fleet/deadlines'
import { INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { event } from '@/__tests__/helpers/fleet'

describe('resolveDeadlines', () => {
  it('returns an entry for every type, with no event where nothing was recorded', () => {
    const deadlines = resolveDeadlines([])

    expect(Object.keys(deadlines).sort()).toEqual([...INSPECTION_TYPES].sort())
    for (const type of INSPECTION_TYPES) {
      expect(deadlines[type]).toEqual({
        type,
        latest: null,
        nextDueAt: null,
        kmSincePrevious: null,
      })
    }
  })

  // The whole derivation-only model rests on this: "current" means most recently performed, not the
  // furthest-away due date. A backdated correction entered late must not become the current deadline.
  it('takes the newest event by performedAt even when an older one is due later', () => {
    const older = event('TECHNICAL', '2025-08-01', { nextDueAt: '2027-08-01' })
    const newer = event('TECHNICAL', '2026-08-01', { nextDueAt: '2026-09-01' })

    const deadline = resolveDeadlines([newer, older]).TECHNICAL

    expect(deadline.latest?.id).toBe(newer.id)
    expect(deadline.nextDueAt).toBe('2026-09-01')
  })

  it('keeps the five types independent', () => {
    const technical = event('TECHNICAL', '2026-08-01', { nextDueAt: '2027-08-01' })
    const insurance = event('INSURANCE', '2026-02-01', { nextDueAt: '2027-02-01' })

    const deadlines = resolveDeadlines([technical, insurance])

    expect(deadlines.TECHNICAL.nextDueAt).toBe('2027-08-01')
    expect(deadlines.INSURANCE.nextDueAt).toBe('2027-02-01')
    expect(deadlines.OIL_CHANGE.latest).toBeNull()
  })

  it('measures the distance since the previous event of the same type', () => {
    const previous = event('OIL_CHANGE', '2025-08-01', { odometer: 100_000 })
    const latest = event('OIL_CHANGE', '2026-08-01', { odometer: 115_000 })

    expect(resolveDeadlines([previous, latest]).OIL_CHANGE.kmSincePrevious).toBe(15_000)
  })

  // null, never 0 — "we don't know" and "the car didn't move" are different facts, and the UI has to
  // be able to say so.
  it('reports an unknown distance as null when either reading is missing', () => {
    const withReading = event('OIL_CHANGE', '2025-08-01', { odometer: 100_000 })
    const withoutReading = event('OIL_CHANGE', '2026-08-01')

    expect(resolveDeadlines([withReading, withoutReading]).OIL_CHANGE.kmSincePrevious).toBeNull()
    expect(resolveDeadlines([withoutReading]).OIL_CHANGE.kmSincePrevious).toBeNull()
  })

  it('reports a genuinely stationary car as 0', () => {
    const previous = event('OIL_CHANGE', '2025-08-01', { odometer: 100_000 })
    const latest = event('OIL_CHANGE', '2026-08-01', { odometer: 100_000 })

    expect(resolveDeadlines([previous, latest]).OIL_CHANGE.kmSincePrevious).toBe(0)
  })
})

describe('latestOdometerReading', () => {
  it('is the newest reading across all types, not just the oil changes', () => {
    const oil = event('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 108_000 })
    const unknown = event('TYRES', '2026-07-01')

    expect(latestOdometerReading([oil, technical, unknown])).toBe(108_000)
  })

  it('is null when no event carries a reading', () => {
    expect(latestOdometerReading([event('TYRES', '2026-07-01')])).toBeNull()
  })
})

describe('kmSinceOilChange', () => {
  it('measures the newest reading of any type against the last oil change', () => {
    const oil = event('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 208_000 })

    expect(kmSinceOilChange([oil, technical])).toBe(108_000)
  })

  it('measures from the NEWEST oil change, not the first one', () => {
    const older = event('OIL_CHANGE', '2025-01-01', { odometer: 40_000 })
    const newer = event('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 108_000 })

    expect(kmSinceOilChange([older, newer, technical])).toBe(8_000)
  })

  it('is null when the oil change carries no reading', () => {
    const oil = event('OIL_CHANGE', '2026-01-01')
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 108_000 })

    expect(kmSinceOilChange([oil, technical])).toBeNull()
  })

  it('is null when the car has never had an oil change recorded', () => {
    expect(kmSinceOilChange([event('TECHNICAL', '2026-06-01', { odometer: 108_000 })])).toBeNull()
  })
})
