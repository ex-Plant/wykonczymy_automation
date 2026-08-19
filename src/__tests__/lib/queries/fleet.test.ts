import { describe, expect, it } from 'vitest'
import { historyOfType, toRow, type FleetDatasetT } from '@/lib/queries/fleet'
import type { InspectionTypeT } from '@/lib/fleet/inspection-types'

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
  cost: null,
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
}

describe('toRow', () => {
  it('reports every type with no event as "no data", never as a met deadline', () => {
    const row = toRow(vehicle, [], TODAY)

    expect(row.deadlines.TECHNICAL).toEqual({
      nextDueAt: null,
      daysLeft: null,
      bucket: null,
      hasEvent: false,
    })
    expect(Object.values(row.deadlines).every((deadline) => !deadline.hasEvent)).toBe(true)
  })

  it('distinguishes a recorded event without a due date from no event at all', () => {
    const row = toRow(vehicle, [datasetEvent('TYRES', '2026-04-01T00:00:00.000Z')], TODAY)

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
    )

    expect(row.deadlines.INSURANCE).toMatchObject({ hasEvent: true, bucket: null })
    expect(row.deadlines.OIL_CHANGE.hasEvent).toBe(false)
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
    const row = toRow(vehicle, [oil, technical], '2026-08-18')

    expect(row.latestOdometer).toBe(108_000)
    expect(row.kmSinceOilChange).toBe(8_000)
  })

  it('leaves both null when nothing carries a reading', () => {
    const row = toRow(vehicle, [datasetEvent('TECHNICAL', '2026-06-01')], '2026-08-18')

    expect(row.latestOdometer).toBeNull()
    expect(row.kmSinceOilChange).toBeNull()
  })
})
