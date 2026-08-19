'use server'

import { z } from 'zod'
import {
  vehicleSchema,
  type VehicleFormDataT,
} from '@/components/forms/vehicle-form/vehicle-schema'
import {
  inspectionSchema,
  type InspectionFormDataT,
} from '@/components/forms/inspection-form/inspection-schema'
import { warsawToday } from '@/lib/fleet/days'
import { activeFlags, nextFlags, parseVehicleFlags } from '@/lib/fleet/flags'
import { INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { toInspectionEvent } from '@/lib/fleet/map-inspection'
import { validateAction, protectedAction } from './run-action'

const flagsSchema = z.array(z.enum(INSPECTION_TYPES))

export async function createVehicleAction(data: VehicleFormDataT) {
  return protectedAction(
    'createVehicleAction',
    async ({ payload }) => {
      const parsed = validateAction(vehicleSchema, data)
      if (!parsed.success) return parsed

      await payload.create({ collection: 'vehicles', data: parsed.data })

      return { success: true }
    },
    ['vehicles'],
  )
}

export async function updateVehicleAction(id: number, data: VehicleFormDataT) {
  return protectedAction(
    'updateVehicleAction',
    async ({ payload }) => {
      const parsed = validateAction(vehicleSchema, data)
      if (!parsed.success) return parsed

      await payload.update({ collection: 'vehicles', id, data: parsed.data })

      return { success: true }
    },
    ['vehicles'],
  )
}

export async function createInspectionAction(data: InspectionFormDataT) {
  return protectedAction(
    'createInspectionAction',
    async ({ payload }) => {
      const parsed = validateAction(inspectionSchema, data)
      if (!parsed.success) return parsed

      // The notification-bookkeeping columns are deliberately left unset: a fresh event is the new
      // current deadline for its (vehicle, type) pair, so it starts out un-notified on both legs and
      // the superseded row stops being read at all.
      await payload.create({ collection: 'vehicle-inspections', data: parsed.data })

      return { success: true }
    },
    ['vehicleInspections'],
  )
}

/**
 * Persist the „do wymiany" marks ticked on a vehicle.
 *
 * The stored map is rebuilt from the ticked set rather than patched: unticking is a removal, and a
 * type whose earlier mark the history already answered has to be re-stamped with today — keeping its
 * stale day would make the tick a no-op. Hence the read of the current events before writing.
 */
export async function setVehicleFlagsAction(vehicleId: number, types: InspectionTypeT[]) {
  return protectedAction(
    'setVehicleFlagsAction',
    async ({ payload }) => {
      const parsed = validateAction(flagsSchema, types)
      if (!parsed.success) return parsed

      const vehicle = await payload.findByID({
        collection: 'vehicles',
        id: vehicleId,
        depth: 0,
        overrideAccess: true,
      })
      const inspections = await payload.find({
        collection: 'vehicle-inspections',
        where: { vehicle: { equals: vehicleId } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })

      const current = parseVehicleFlags(vehicle.flags)
      const events = inspections.docs.map(toInspectionEvent)

      await payload.update({
        collection: 'vehicles',
        id: vehicleId,
        data: {
          flags: nextFlags({
            current,
            active: activeFlags(current, events),
            selected: parsed.data,
            today: warsawToday(),
          }),
        },
      })

      return { success: true }
    },
    ['vehicles'],
  )
}
