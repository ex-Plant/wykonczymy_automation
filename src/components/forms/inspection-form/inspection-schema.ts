import { z } from 'zod'
import { INSPECTION_TYPES } from '@/lib/fleet/inspection-types'

// Form-input layer: strings throughout, including the numeric fields — an <input type="number">
// still hands back a string, and '' is how "left empty" arrives.
export const inspectionFormSchema = z.object({
  vehicle: z.string().min(1, 'Pojazd jest wymagany'),
  type: z.enum(INSPECTION_TYPES),
  performedAt: z.string().min(1, 'Data wykonania jest wymagana'),
  nextDueAt: z.string(),
  odometer: z.string(),
  nextDueOdometer: z.string(),
  // Optional again: an imported przegląd genuinely has no price, and „0" would be a lie rather than
  // a gap. `''` reaches the domain layer as `null`, never as `0`.
  cost: z
    .string()
    .refine((value) => value === '' || Number(value) >= 0, 'Koszt nie może być ujemny'),
  insurer: z.string(),
  policyNumber: z.string(),
  note: z.string(),
})

export type InspectionFormValuesT = z.infer<typeof inspectionFormSchema>

// Domain layer the action validates. `attachments` are media ids the client uploaded before submit,
// so they never travel through the form's persisted draft.
export const inspectionSchema = z.object({
  vehicle: z.number(),
  type: z.enum(INSPECTION_TYPES),
  performedAt: z.string().min(1, 'Data wykonania jest wymagana'),
  nextDueAt: z.string().optional(),
  odometer: z.number().nonnegative().optional(),
  nextDueOdometer: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().nullable(),
  // Independently optional: the przyczepa's polisa carries a number and no insurer.
  insurer: z.string().default(''),
  // Text, never a number — `354E000003305` is not finite as a float and `22044 4672279` has a space.
  policyNumber: z.string().default(''),
  note: z.string().default(''),
  attachments: z.array(z.number()).default([]),
})

export type InspectionFormDataT = z.infer<typeof inspectionSchema>
