import { z } from 'zod'

// Rows carry an `id` only so React can key them across adds and removes — the index would reorder
// under a removal and re-key every input below it, blurring the one being typed in.
export const recipientListFormSchema = z.object({
  emails: z
    .array(
      z.object({
        id: z.string(),
        email: z.string().trim().pipe(z.email('Nieprawidłowy adres e-mail')),
      }),
    )
    .min(1, 'Lista musi mieć co najmniej jednego odbiorcę'),
})

export type RecipientListFormValuesT = z.infer<typeof recipientListFormSchema>

export const makeRecipientRow = (email = ''): RecipientListFormValuesT['emails'][number] => ({
  id: crypto.randomUUID(),
  email,
})
