import { describe, it, expect } from 'vitest'
import { shouldNotify } from '@/lib/fleet/should-notify'
import { OVERDUE } from '@/lib/fleet/thresholds'
import { event } from '@/__tests__/helpers/fleet'

const TODAY = '2026-08-18'

describe('shouldNotify — date leg', () => {
  it('stays silent when the deadline is still far away', () => {
    const row = event('TECHNICAL', '2025-08-01', { nextDueAt: '2026-12-01' })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: null })).toEqual({
      bucket: null,
      date: false,
      odometer: false,
    })
  })

  it('fires the first time a bucket is entered', () => {
    const row = event('TECHNICAL', '2025-08-01', { nextDueAt: '2026-08-24' })

    const decision = shouldNotify({ row, today: TODAY, latestOdometer: null })

    expect(decision.bucket).toBe(7)
    expect(decision.date).toBe(true)
  })

  it('stays silent on the next run in the same bucket', () => {
    const row = event('TECHNICAL', '2025-08-01', {
      nextDueAt: '2026-08-24',
      notifiedThreshold: 7,
      notifiedAt: '2026-08-17T05:00:00.000Z',
    })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: null }).date).toBe(false)
  })

  // The 30-day bucket colours the listing and feeds the „Flota" badge, but never mails.
  it('stays silent a month out, then fires when the deadline reaches a week', () => {
    const row = event('TECHNICAL', '2025-08-01', { nextDueAt: '2026-09-10' })

    const far = shouldNotify({ row, today: TODAY, latestOdometer: null })

    expect(far.bucket).toBe(30)
    expect(far.date).toBe(false)
    expect(shouldNotify({ row, today: '2026-09-05', latestOdometer: null }).date).toBe(true)
  })

  it('fires again once the deadline escalates into a tighter bucket', () => {
    const row = event('TECHNICAL', '2025-08-01', {
      nextDueAt: '2026-08-22',
      notifiedThreshold: 30,
      notifiedAt: '2026-07-30T05:00:00.000Z',
    })

    const decision = shouldNotify({ row, today: TODAY, latestOdometer: null })

    expect(decision.bucket).toBe(7)
    expect(decision.date).toBe(true)
  })

  // An overdue inspection that goes quiet after one mail is worse than no mail at all, so OVERDUE is
  // the one bucket that re-nags — weekly, not daily.
  it('re-nags an overdue deadline after more than a week', () => {
    const stamped = (notifiedAt: string) =>
      event('TECHNICAL', '2025-08-01', {
        nextDueAt: '2026-07-01',
        notifiedThreshold: OVERDUE,
        notifiedAt,
      })

    expect(
      shouldNotify({ row: stamped('2026-08-12T05:00:00.000Z'), today: TODAY, latestOdometer: null })
        .date,
    ).toBe(false)
    expect(
      shouldNotify({ row: stamped('2026-08-11T05:00:00.000Z'), today: TODAY, latestOdometer: null })
        .date,
    ).toBe(false)
    expect(
      shouldNotify({ row: stamped('2026-08-10T05:00:00.000Z'), today: TODAY, latestOdometer: null })
        .date,
    ).toBe(true)
  })
})

describe('shouldNotify — kilometre leg', () => {
  const oil = (overrides = {}) =>
    event('OIL_CHANGE', '2026-01-10', {
      nextDueAt: '2027-01-10',
      nextDueOdometer: 130_000,
      ...overrides,
    })

  it('stays silent right up to the target', () => {
    expect(shouldNotify({ row: oil(), today: TODAY, latestOdometer: 130_000 }).odometer).toBe(false)
  })

  it('fires on the first kilometre past the target', () => {
    expect(shouldNotify({ row: oil(), today: TODAY, latestOdometer: 130_001 }).odometer).toBe(true)
  })

  it('fires when the target is already passed', () => {
    expect(shouldNotify({ row: oil(), today: TODAY, latestOdometer: 141_000 }).odometer).toBe(true)
  })

  it('stays silent on a second run once stamped', () => {
    const row = oil({ odometerNotifiedAt: '2026-08-01T05:00:00.000Z' })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: 141_000 }).odometer).toBe(false)
  })

  it('stays silent without a current reading to compare against', () => {
    expect(shouldNotify({ row: oil(), today: TODAY, latestOdometer: null }).odometer).toBe(false)
  })

  it('is an oil-change concept only — no other type has a kilometre target', () => {
    const row = event('TECHNICAL', '2026-01-10', { nextDueOdometer: 130_000 })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: 141_000 }).odometer).toBe(false)
  })

  // The two legs are independent on purpose: an oil change can be a year away by date and 200 km away
  // by mileage, and sharing one bookkeeping column would let either silence the other.
  it('fires on mileage while the date leg is silent', () => {
    const decision = shouldNotify({ row: oil(), today: TODAY, latestOdometer: 141_000 })

    expect(decision).toEqual({ bucket: null, date: false, odometer: true })
  })
})

describe('shouldNotify — kilometre leg without a typed target', () => {
  const TODAY = '2026-08-18'

  it('fires once the interval since the oil change is exceeded', () => {
    const row = event('OIL_CHANGE', '2026-01-10', { odometer: 100_000 })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: 110_001 }).odometer).toBe(true)
  })

  it('stays quiet inside the interval', () => {
    const row = event('OIL_CHANGE', '2026-01-10', { odometer: 100_000 })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: 110_000 }).odometer).toBe(false)
  })

  // A typed target is the owner's own interval; the fallback must not second-guess it.
  it('does not fall back to the interval when a target was typed', () => {
    const row = event('OIL_CHANGE', '2026-01-10', {
      odometer: 100_000,
      nextDueOdometer: 130_000,
    })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: 115_000 }).odometer).toBe(false)
  })

  it('stays quiet once already announced', () => {
    const row = event('OIL_CHANGE', '2026-01-10', {
      odometer: 100_000,
      odometerNotifiedAt: '2026-08-01T00:00:00.000Z',
    })

    expect(shouldNotify({ row, today: TODAY, latestOdometer: 130_000 }).odometer).toBe(false)
  })
})
