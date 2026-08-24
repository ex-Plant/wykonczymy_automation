import { describe, expect, it } from 'vitest'
import { historyOfType, toRow, type FleetDatasetT } from '@/lib/queries/fleet'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'
import { ALL_TIME } from '@/lib/utils/date-range'

// The projections below are what the listing and the digest both read. A deadline that renders
// "fine" for a vehicle with nothing recorded, or a mileage delta computed against a missing
// reading, is exactly the blind spot the module exists to close — so they are pinned here rather
// than left to a browser check.

const TODAY = '2026-08-18'

type EventT = FleetDatasetT['events'][number]

let nextId = 1

const datasetEvent = (
  type: InspectionTypeT,
  performedAt: string,
  overrides: Partial<EventT> = {},
): EventT => ({
  id: nextId++,
  vehicleId: 1,
  type,
  performedAt,
  nextDueAt: null,
  odometer: null,
  nextDueOdometer: null,
  notifiedThreshold: null,
  notifiedAt: null,
  odometerNotifiedAt: null,
  cost: 100,
  note: '',
  attachmentCount: 0,
  ...overrides,
})

const vehicle: FleetDatasetT['vehicles'][number] = {
  id: 1,
  registration: 'WA12345',
  make: 'Ford',
  model: 'Transit',
  status: 'ACTIVE',
  year: 2019,
  vin: '',
  flags: {},
}

describe('toRow', () => {
  it('reports every type with no event as "no data", never as a met deadline', () => {
    const row = toRow(vehicle, [], TODAY, ALL_TIME)

    expect(row.deadlines.TECHNICAL).toEqual({
      nextDueAt: null,
      daysLeft: null,
      bucket: null,
      hasEvent: false,
    })
    expect(Object.values(row.deadlines).every((deadline) => !deadline.hasEvent)).toBe(true)
  })

  it('distinguishes a recorded event without a due date from no event at all', () => {
    const row = toRow(vehicle, [datasetEvent('TYRES', '2026-04-01T00:00:00.000Z')], TODAY, ALL_TIME)

    expect(row.deadlines.TYRES).toEqual({
      nextDueAt: null,
      daysLeft: null,
      bucket: null,
      hasEvent: true,
    })
  })

  it('classifies an overdue deadline with a negative day count', () => {
    const row = toRow(
      vehicle,
      [
        datasetEvent('TECHNICAL', '2025-08-01T00:00:00.000Z', {
          nextDueAt: '2026-08-11T00:00:00.000Z',
        }),
      ],
      TODAY,
      ALL_TIME,
    )

    expect(row.deadlines.TECHNICAL).toMatchObject({
      nextDueAt: '2026-08-11',
      daysLeft: -7,
      bucket: 0,
      hasEvent: true,
    })
  })

  it('keeps types independent — one recorded type does not answer for the others', () => {
    const row = toRow(
      vehicle,
      [
        datasetEvent('INSURANCE', '2026-08-01T00:00:00.000Z', {
          nextDueAt: '2027-08-01T00:00:00.000Z',
        }),
      ],
      TODAY,
      ALL_TIME,
    )

    expect(row.deadlines.INSURANCE).toMatchObject({ hasEvent: true, bucket: null })
    expect(row.deadlines.OIL_CHANGE.hasEvent).toBe(false)
  })
})

describe('toRow flags', () => {
  it('carries a mark no inspection answers', () => {
    const row = toRow({ ...vehicle, flags: { TYRES: '2026-08-01' } }, [], TODAY, ALL_TIME)

    expect(row.activeFlags).toEqual(['TYRES'])
  })

  // The row is the only place the two surfaces read, so clearing must happen here, not in the UI.
  it('drops a mark the history already answers', () => {
    const row = toRow(
      { ...vehicle, flags: { TYRES: '2026-08-01' } },
      [datasetEvent('TYRES', '2026-08-05T00:00:00.000Z')],
      TODAY,
      ALL_TIME,
    )

    expect(row.activeFlags).toEqual([])
  })

  it('keeps a mark when the inspection predates it', () => {
    const row = toRow(
      { ...vehicle, flags: { TYRES: '2026-08-01' } },
      [datasetEvent('TYRES', '2026-04-01T00:00:00.000Z')],
      TODAY,
      ALL_TIME,
    )

    expect(row.activeFlags).toEqual(['TYRES'])
  })
})

describe('historyOfType', () => {
  it('orders newest first and measures each entry against the one below it', () => {
    const events = [
      datasetEvent('OIL_CHANGE', '2025-02-01T00:00:00.000Z', { odometer: 100_000 }),
      datasetEvent('OIL_CHANGE', '2026-02-01T00:00:00.000Z', { odometer: 115_000 }),
    ]

    const history = historyOfType(events, 'OIL_CHANGE')

    expect(history.map((entry) => entry.performedAt)).toEqual(['2026-02-01', '2025-02-01'])
    expect(history[0].kmSincePrevious).toBe(15_000)
    // The oldest entry has nothing to measure against — not a zero-kilometre service.
    expect(history[1].kmSincePrevious).toBeNull()
  })

  it('leaves the delta null when either reading is missing', () => {
    const events = [
      datasetEvent('OIL_CHANGE', '2025-02-01T00:00:00.000Z'),
      datasetEvent('OIL_CHANGE', '2026-02-01T00:00:00.000Z', { odometer: 115_000 }),
    ]

    expect(historyOfType(events, 'OIL_CHANGE')[0].kmSincePrevious).toBeNull()
  })

  it('excludes other types', () => {
    const events = [
      datasetEvent('OIL_CHANGE', '2026-02-01T00:00:00.000Z'),
      datasetEvent('TECHNICAL', '2026-03-01T00:00:00.000Z'),
    ]

    expect(historyOfType(events, 'TECHNICAL')).toHaveLength(1)
    expect(historyOfType(events, 'WARRANTY')).toEqual([])
  })
})

describe('toRow — oil interval', () => {
  it('carries the newest reading and the distance since the last oil change', () => {
    const oil = datasetEvent('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = datasetEvent('TECHNICAL', '2026-06-01', { odometer: 108_000 })
    const row = toRow(vehicle, [oil, technical], '2026-08-18', ALL_TIME)

    expect(row.latestOdometer).toBe(108_000)
    expect(row.kmSinceOilChange).toBe(8_000)
  })

  it('leaves both null when nothing carries a reading', () => {
    const row = toRow(vehicle, [datasetEvent('TECHNICAL', '2026-06-01')], '2026-08-18', ALL_TIME)

    expect(row.latestOdometer).toBeNull()
    expect(row.kmSinceOilChange).toBeNull()
  })
})

describe('toRow — costs', () => {
  it('adds up every inspection, whatever its type', () => {
    const row = toRow(
      vehicle,
      [
        datasetEvent('TECHNICAL', '2026-02-01T00:00:00.000Z', { cost: 250 }),
        datasetEvent('TYRES', '2026-03-01T00:00:00.000Z', { cost: 1200 }),
        datasetEvent('OIL_CHANGE', '2026-04-01T00:00:00.000Z', { cost: 400 }),
      ],
      TODAY,
      ALL_TIME,
    )

    expect(row.totalCosts).toBe(1850)
  })

  // Zero is the listing's answer for „nothing spent" — it is not a placeholder for missing data,
  // which is why „Koszt" is a required field.
  it('is zero for a car with no inspections', () => {
    expect(toRow(vehicle, [], TODAY, ALL_TIME).totalCosts).toBe(0)
  })

  it('counts only what falls inside the window', () => {
    const events = [
      datasetEvent('TECHNICAL', '2026-06-30T00:00:00.000Z', { cost: 1 }),
      datasetEvent('TECHNICAL', '2026-07-01T00:00:00.000Z', { cost: 10 }),
      datasetEvent('TECHNICAL', '2026-07-31T00:00:00.000Z', { cost: 100 }),
      datasetEvent('TECHNICAL', '2026-08-01T00:00:00.000Z', { cost: 1000 }),
    ]

    expect(toRow(vehicle, events, TODAY, { from: '2026-07-01', to: '2026-07-31' }).totalCosts).toBe(
      110,
    )
  })

  // The window is a lens on money only. Narrowing it must not make a car look up to date on its
  // inspections, or the filter would quietly hide overdue work.
  it('leaves deadlines, flags and mileage outside the window', () => {
    const events = [
      datasetEvent('TECHNICAL', '2026-01-05T00:00:00.000Z', {
        nextDueAt: '2026-08-11T00:00:00.000Z',
        odometer: 108_000,
      }),
    ]
    const marked = { ...vehicle, flags: { TYRES: '2026-08-01' } }

    const full = toRow(marked, events, TODAY, ALL_TIME)
    const windowed = toRow(marked, events, TODAY, { from: '2026-07-01', to: '2026-07-31' })

    expect(windowed.deadlines).toEqual(full.deadlines)
    expect(windowed.activeFlags).toEqual(full.activeFlags)
    expect(windowed.latestOdometer).toBe(full.latestOdometer)
    expect(windowed.totalCosts).toBe(0)
  })
})
