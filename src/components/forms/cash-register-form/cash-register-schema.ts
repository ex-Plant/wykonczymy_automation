import { z } from 'zod'

// Form-input layer: every field is a string/boolean as the HTML controls produce
// them (the właściciel combobox yields a string id).
export const cashRegisterFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  owner: z.string().min(1, 'Właściciel jest wymagany'),
  type: z.enum(['MAIN', 'AUXILIARY', 'VIRTUAL', 'WORKER']),
  active: z.boolean(),
})

export type CashRegisterFormValuesT = z.infer<typeof cashRegisterFormSchema>

// Domain layer the action validates: derived from the form schema so the field
// list can't drift; the owner id is a number.
export const cashRegisterSchema = cashRegisterFormSchema.extend({
  owner: z.number(),
})

export type CashRegisterFormDataT = z.infer<typeof cashRegisterSchema>
