import { describe, expect, it } from 'vitest'
import { buildFleetDigest, isEmptyDigest } from '@/lib/fleet/reminder-sweep'
import { event, history } from '@/__tests__/helpers/fleet'

const TUESDAY = '2026-08-18'

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
    // WARRANTY is 23 days out — inside the 30-day bucket the listing colours, outside the mail.
    expect(digest.overdue[0].daysLeft).toBe(-7)
    expect(digest.stamps.map((stamp) => stamp.threshold)).toEqual([0, 7])
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
      TUESDAY,
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
            odometer: 116_000,
          }),
        ]),
      ],
      TUESDAY,
    )

    expect(digest.odometer).toEqual([
      {
        inspectionId: expect.any(Number),
        registration: 'WX 00001',
        make: 'Ford',
        model: 'Transit',
        targetOdometer: 115_000,
        latestOdometer: 116_000,
        kmRemaining: -1_000,
        kmSinceChange: 16_000,
      },
    ])
    // The date leg said nothing, so nothing may be stamped as date-announced.
    expect(digest.stamps).toEqual([
      { inspectionId: expect.any(Number), threshold: null, odometer: true },
    ])
    expect(digest.overdue.concat(digest.within7)).toEqual([])
  })

  it('stays silent while a typed kilometre target is still ahead', () => {
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

    expect(digest.odometer).toEqual([])
  })

  // The przyczepa's przegląd is „bezterminowo", yet the sheet import leaves a TECHNICAL row on file.
  // Judged on its date alone that row is years overdue, and the mail would shout PO TERMINIE at the
  // one car the listing renders as having no termin at all.
  it('never reports a type the vehicle is exempt from', () => {
    const overdueTechnical = [
      event('TECHNICAL', '2024-08-01T00:00:00.000Z', { nextDueAt: '2025-08-01T00:00:00.000Z' }),
    ]

    const exempt = buildFleetDigest(
      [history(overdueTechnical, { exemptions: ['TECHNICAL'] })],
      TUESDAY,
    )

    expect(isEmptyDigest(exempt)).toBe(true)
    expect(exempt.stamps).toEqual([])
    // The same row without the exemption does fire — otherwise this spec would pass on a digest that
    // is broken for every car.
    expect(buildFleetDigest([history(overdueTechnical)], TUESDAY).overdue).toHaveLength(1)
  })
})

describe('buildFleetDigest — oil interval without a typed target', () => {
  it('derives the target from the interval so an untargeted oil change is still watched', () => {
    const digest = buildFleetDigest(
      [
        history([
          event('OIL_CHANGE', '2024-01-01T00:00:00.000Z', { odometer: 100_000 }),
          event('TECHNICAL', '2026-08-01T00:00:00.000Z', { odometer: 115_000 }),
        ]),
      ],
      TUESDAY,
    )

    expect(digest.odometer).toEqual([
      {
        inspectionId: expect.any(Number),
        registration: 'WX 00001',
        make: 'Ford',
        model: 'Transit',
        targetOdometer: 110_000,
        latestOdometer: 115_000,
        kmRemaining: -5_000,
        kmSinceChange: 15_000,
      },
    ])
  })
})
