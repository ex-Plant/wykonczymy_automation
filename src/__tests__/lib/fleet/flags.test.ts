import { describe, it, expect } from 'vitest'
import { activeFlags, nextFlags, parseVehicleFlags } from '@/lib/fleet/flags'
import { event } from '@/__tests__/helpers/fleet'

describe('parseVehicleFlags', () => {
  it('reads the marks back off a jsonb payload', () => {
    expect(parseVehicleFlags({ OIL_CHANGE: '2026-08-19', TYRES: '2026-07-01' })).toEqual({
      OIL_CHANGE: '2026-08-19',
      TYRES: '2026-07-01',
    })
  })

  // Every vehicle predating the column reads back null.
  it('treats null and garbage as no marks', () => {
    expect(parseVehicleFlags(null)).toEqual({})
    expect(parseVehicleFlags('OIL_CHANGE')).toEqual({})
    expect(parseVehicleFlags(42)).toEqual({})
  })

  it('drops unknown types and non-day values', () => {
    expect(
      parseVehicleFlags({ OIL_CHANGE: '2026-08-19', WIPERS: '2026-08-19', TYRES: true }),
    ).toEqual({ OIL_CHANGE: '2026-08-19' })
  })
})

describe('activeFlags', () => {
  it('keeps a mark that no inspection answers', () => {
    expect(activeFlags({ OIL_CHANGE: '2026-08-19' }, [])).toEqual(['OIL_CHANGE'])
  })

  it('retires a mark answered the same day', () => {
    const events = [event('OIL_CHANGE', '2026-08-19')]

    expect(activeFlags({ OIL_CHANGE: '2026-08-19' }, events)).toEqual([])
  })

  // Backfilling last year's service must not silence a mark made today.
  it('keeps a mark when the inspection predates it', () => {
    const events = [event('OIL_CHANGE', '2026-06-01')]

    expect(activeFlags({ OIL_CHANGE: '2026-08-19' }, events)).toEqual(['OIL_CHANGE'])
  })

  it('ignores an inspection of another type', () => {
    const events = [event('TECHNICAL', '2026-08-20')]

    expect(activeFlags({ OIL_CHANGE: '2026-08-19' }, events)).toEqual(['OIL_CHANGE'])
  })

  it('returns the marks in domain order, not insertion order', () => {
    expect(activeFlags({ TYRES: '2026-08-19', TECHNICAL: '2026-08-19' }, [])).toEqual([
      'TECHNICAL',
      'TYRES',
    ])
  })
})

describe('nextFlags', () => {
  const today = '2026-08-19'

  it('leaves a standing mark on its original day', () => {
    const next = nextFlags({
      current: { OIL_CHANGE: '2026-07-01' },
      active: ['OIL_CHANGE'],
      selected: ['OIL_CHANGE'],
      today,
    })

    expect(next).toEqual({ OIL_CHANGE: '2026-07-01' })
  })

  it('stamps a newly ticked type with today', () => {
    expect(nextFlags({ current: {}, active: [], selected: ['TYRES'], today })).toEqual({
      TYRES: today,
    })
  })

  // The retired entry still carries its old day; keeping it would make the tick a no-op.
  it('re-stamps a type whose earlier mark was already retired', () => {
    const next = nextFlags({
      current: { OIL_CHANGE: '2026-07-01' },
      active: [],
      selected: ['OIL_CHANGE'],
      today,
    })

    expect(next).toEqual({ OIL_CHANGE: today })
  })

  it('drops what was unticked', () => {
    const next = nextFlags({
      current: { OIL_CHANGE: '2026-07-01', TYRES: '2026-07-01' },
      active: ['OIL_CHANGE', 'TYRES'],
      selected: ['TYRES'],
      today,
    })

    expect(next).toEqual({ TYRES: '2026-07-01' })
  })
})
