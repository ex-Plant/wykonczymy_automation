import { describe, expect, it } from 'vitest'
import { resetNotificationBookkeeping } from '@/lib/fleet/reset-notification-bookkeeping'

// A stamp says "the figure below was announced". Edit the figure and the stamp becomes a lie that
// silences the row forever — this is the guard for that.

describe('resetNotificationBookkeeping', () => {
  it('clears nothing when the announced figures are untouched', () => {
    const row = { nextDueAt: '2026-09-01', nextDueOdometer: 130_000, odometer: 100_000 }

    expect(resetNotificationBookkeeping(row, { ...row, note: 'literówka' } as typeof row)).toEqual(
      {},
    )
  })

  it('clears the km stamp when a mistyped oil target is corrected', () => {
    const previous = { nextDueOdometer: 101_000, odometer: 100_000 }
    const next = { nextDueOdometer: 130_000, odometer: 100_000 }

    expect(resetNotificationBookkeeping(previous, next)).toEqual({ odometerNotifiedAt: null })
  })

  it('clears the km stamp when the reading it was measured from changes', () => {
    expect(resetNotificationBookkeeping({ odometer: 100_000 }, { odometer: 112_000 })).toEqual({
      odometerNotifiedAt: null,
    })
  })

  it('clears the date stamps when the due date moves', () => {
    const result = resetNotificationBookkeeping(
      { nextDueAt: '2026-09-01' },
      { nextDueAt: '2027-09-01' },
    )

    expect(result).toEqual({ notifiedThreshold: null, notifiedAt: null })
  })

  it('treats an explicitly cleared due date as a change', () => {
    expect(resetNotificationBookkeeping({ nextDueAt: '2026-09-01' }, { nextDueAt: null })).toEqual({
      notifiedThreshold: null,
      notifiedAt: null,
    })
  })

  // Payload hands a collection beforeChange the raw patch, so the sweep's own stamp write names
  // none of the announced figures. Read absent as cleared and that write erases its own stamp —
  // the digest then re-announces the same deadline every single day.
  it('clears nothing for a patch that names no announced figure', () => {
    const stored = { nextDueAt: '2026-09-01', nextDueOdometer: 130_000, odometer: 100_000 }

    expect(resetNotificationBookkeeping(stored, { notifiedAt: '2026-08-19' } as never)).toEqual({})
  })

  it('clears both axes when both figures move', () => {
    const result = resetNotificationBookkeeping(
      { nextDueAt: '2026-09-01', nextDueOdometer: 101_000 },
      { nextDueAt: '2027-09-01', nextDueOdometer: 130_000 },
    )

    expect(result).toEqual({
      notifiedThreshold: null,
      notifiedAt: null,
      odometerNotifiedAt: null,
    })
  })
})
