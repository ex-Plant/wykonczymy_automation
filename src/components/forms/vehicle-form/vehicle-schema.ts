import { z } from 'zod'
import { VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'

// Form-input layer: every field is a string, as the HTML controls produce them.
export const vehicleFormSchema = z.object({
  registration: z.string().min(1, 'Numer rejestracyjny jest wymagany'),
  make: z.string().min(1, 'Marka jest wymagana'),
  model: z.string().min(1, 'Model jest wymagany'),
  year: z.string(),
  vin: z.string(),
  status: z.enum(VEHICLE_STATUSES),
})

export type VehicleFormValuesT = z.infer<typeof vehicleFormSchema>

// Domain layer the action validates: derived from the form schema so the field list can't drift.
export const vehicleSchema = vehicleFormSchema.extend({
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().default(''),
})

export type VehicleFormDataT = z.infer<typeof vehicleSchema>
