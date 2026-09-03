import { z } from 'zod'
import {
  equipmentTargetDataShape,
  equipmentTargetFormShape,
  refineExactlyOneTarget,
  refineTargetChoice,
} from './equipment-target-schema'

// Form-input layer: strings throughout, as the HTML controls produce them.
const transferFormShape = z.object({
  ...equipmentTargetFormShape,
  equipment: z.string().min(1, 'Sprzęt jest wymagany'),
  investment: z.string(),
  // Optional even on a service entry: the faktura arrives after the tool does, so the amount is
  // filled in later by editing the row rather than guessed now.
  cost: z
    .string()
    .refine((value) => value === '' || Number(value) >= 0, 'Koszt nie może być ujemny'),
  note: z.string(),
})

export const equipmentTransferFormSchema = transferFormShape.superRefine(refineTargetChoice)

export type EquipmentTransferFormValuesT = z.infer<typeof transferFormShape>

// Domain layer the action validates: derived from the form shape so the field list can't drift.
export const equipmentTransferSchema = transferFormShape
  .omit({ targetKind: true })
  .extend({
    ...equipmentTargetDataShape,
    equipment: z.number(),
    investment: z.number().nullable(),
    cost: z.number().nonnegative().nullable(),
    note: z.string().default(''),
  })
  .superRefine(refineExactlyOneTarget)

export type EquipmentTransferDataT = z.infer<typeof equipmentTransferSchema>
