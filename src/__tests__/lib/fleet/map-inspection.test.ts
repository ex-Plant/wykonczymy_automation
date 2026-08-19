import { describe, expect, it } from 'vitest'
import { toInspectionEvent } from '@/lib/fleet/map-inspection'
import type { VehicleInspection } from '@/payload-types'

describe('toInspectionEvent', () => {
  it('flattens a depth-0 relation id and counts attachments without loading them', () => {
    const row = {
      id: 9,
      vehicle: 4,
      type: 'OIL_CHANGE',
      performedAt: '2026-02-01T00:00:00.000Z',
      attachments: [11, 12],
    } as unknown as VehicleInspection

    expect(toInspectionEvent(row)).toMatchObject({
      vehicleId: 4,
      attachmentCount: 2,
      nextDueAt: null,
      note: '',
    })
  })

  it('accepts a populated relation object too', () => {
    const row = {
      id: 9,
      vehicle: { id: 4 },
      type: 'TECHNICAL',
      performedAt: '2026-02-01T00:00:00.000Z',
    } as unknown as VehicleInspection

    expect(toInspectionEvent(row).vehicleId).toBe(4)
    expect(toInspectionEvent(row).attachmentCount).toBe(0)
  })
})
