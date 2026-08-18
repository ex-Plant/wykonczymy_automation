'use server'

import {
  vehicleSchema,
  type VehicleFormDataT,
} from '@/components/forms/vehicle-form/vehicle-schema'
import {
  inspectionSchema,
  type InspectionFormDataT,
} from '@/components/forms/inspection-form/inspection-schema'
import { validateAction, protectedAction } from './run-action'

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
