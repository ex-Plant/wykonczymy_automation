import { describe, expect, it } from 'vitest'
import { buildFleetDigest, isEmptyDigest, type VehicleHistoryT } from '@/lib/fleet/reminder-sweep'
import { event } from '@/__tests__/helpers/fleet'
import type { InspectionEventT, VehicleSummaryT } from '@/lib/fleet/types'

// 2026-08-18 is a Tuesday; 2026-08-17 a Monday. The weekly missing-data section hangs off exactly
// that difference, so both days are pinned rather than derived.
const TUESDAY = '2026-08-18'
const MONDAY = '2026-08-17'

const vehicle = (overrides: Partial<VehicleSummaryT> = {}): VehicleSummaryT => ({
  id: 1,
  registration: 'WA12345',
  make: 'Ford',
  model: 'Transit',
  status: 'ACTIVE',
  ...overrides,
})

const history = (
  events: InspectionEventT[],
  overrides: Partial<VehicleSummaryT> = {},
): VehicleHistoryT => ({ vehicle: vehicle(overrides), events })

describe('buildFleetDigest', () => {
  it('sends nothing when every deadline is far away', () => {
    const digest = buildFleetDigest(
      [
        history([
          event('TECHNICAL', '2026-06-01T00:00:00.000Z', { nextDueAt: '2027-06-01T00:00:00.000Z' }),
        ]),
      ],
      TUESDAY,
    )

    expect(isEmptyDigest(digest)).toBe(true)
    expect(digest.stamps).toEqual([])
  })

  it('groups a mixed day into the right sections and stamps only what it announced', () => {
    const digest = buildFleetDigest(
      [
        history([
          event('TECHNICAL', '2025-08-01T00:00:00.000Z', { nextDueAt: '2026-08-11T00:00:00.000Z' }),
          event('INSURANCE', '2025-08-01T00:00:00.000Z', { nextDueAt: '2026-08-20T00:00:00.000Z' }),
          event('WARRANTY', '2025-08-01T00:00:00.000Z', { nextDueAt: '2026-09-10T00:00:00.000Z' }),
          event('TYRES', '2026-04-01T00:00:00.000Z', { nextDueAt: '2027-04-01T00:00:00.000Z' }),
        ]),
      ],
      TUESDAY,
    )

    expect(digest.overdue.map((entry) => entry.type)).toEqual(['TECHNICAL'])
    expect(digest.within7.map((entry) => entry.type)).toEqual(['INSURANCE'])
    expect(digest.within30.map((entry) => entry.type)).toEqual(['WARRANTY'])
    expect(digest.overdue[0].daysLeft).toBe(-7)
    expect(digest.stamps.map((stamp) => stamp.threshold)).toEqual([0, 7, 30])
  })

  it('stays silent on a second run once the same buckets are stamped', () => {
    const stamped = [
      event('TECHNICAL', '2025-08-01T00:00:00.000Z', {
        nextDueAt: '2026-08-20T00:00:00.000Z',
        notifiedThreshold: 7,
        notifiedAt: '2026-08-18T05:00:00.000Z',
      }),
    ]

    expect(isEmptyDigest(buildFleetDigest([history(stamped)], TUESDAY))).toBe(true)
  })

  it('judges only the newest event per type — a renewed deadline retires the old row', () => {
    const digest = buildFleetDigest(
      [
        history([
          event('TECHNICAL', '2025-08-01T00:00:00.000Z', { nextDueAt: '2026-08-11T00:00:00.000Z' }),
          event('TECHNICAL', '2026-08-10T00:00:00.000Z', { nextDueAt: '2027-08-10T00:00:00.000Z' }),
        ]),
      ],
      TUESDAY,
    )

    expect(isEmptyDigest(digest)).toBe(true)
  })

  it('ignores retired vehicles entirely', () => {
    const digest = buildFleetDigest(
      [
        history(
          [
            event('TECHNICAL', '2025-08-01T00:00:00.000Z', {
              nextDueAt: '2026-08-11T00:00:00.000Z',
            }),
          ],
          { status: 'RETIRED' },
        ),
      ],
      MONDAY,
    )

    expect(isEmptyDigest(digest)).toBe(true)
  })

  it('reports the kilometre leg with the reading it was judged against', () => {
    const digest = buildFleetDigest(
      [
        history([
          event('OIL_CHANGE', '2026-01-01T00:00:00.000Z', {
            nextDueAt: '2027-01-01T00:00:00.000Z',
            odometer: 100_000,
            nextDueOdometer: 115_000,
          }),
          event('TECHNICAL', '2026-08-01T00:00:00.000Z', {
            nextDueAt: '2027-08-01T00:00:00.000Z',
            odometer: 114_500,
          }),
        ]),
      ],
      TUESDAY,
    )

    expect(digest.odometer).toEqual([
      {
        inspectionId: expect.any(Number),
        registration: 'WA12345',
        nextDueOdometer: 115_000,
        latestOdometer: 114_500,
        kmRemaining: 500,
      },
    ])
    // The date leg said nothing, so nothing may be stamped as date-announced.
    expect(digest.stamps).toEqual([
      { inspectionId: expect.any(Number), threshold: null, odometer: true },
    ])
    expect(digest.overdue.concat(digest.within7, digest.within30)).toEqual([])
  })

  it('adds the missing-data section on Monday only', () => {
    const bare = [history([])]

    expect(buildFleetDigest(bare, MONDAY).missing).toHaveLength(5)
    expect(buildFleetDigest(bare, TUESDAY).missing).toEqual([])
    // A vehicle with nothing recorded has no deadline that could ever fire — the weekly section is
    // the only thing standing between it and permanent silence.
    expect(isEmptyDigest(buildFleetDigest(bare, TUESDAY))).toBe(true)
  })
})
