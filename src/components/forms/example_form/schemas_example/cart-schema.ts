import { z } from 'zod'

type SelectOptionT = {
  value: string
  label: string
}

export const PROJECT_STAGES: SelectOptionT[] = [
  { value: 'concept', label: 'koncepcja' },
  { value: 'project', label: 'projekt wykonawczy' },
  { value: 'realization', label: 'realizacja' },
]

export const cartSchema = z.object({
  company_name: z.string().min(1),
  email: z.string().min(3, { message: 'Podaj prawidłowy adres email' }),
  nip: z.string().length(10, { message: 'Nieprawidłowy numer NIP' }),
  project_stage: z.string().min(1),

  // consents must be true
  consents: z.object({
    consent1: z.boolean().refine((val) => val === true),
    consent2: z.boolean().refine((val) => val === true),
  }),
  users: z
    .array(
      z.object({
        email: z.email(),
      }),
    )
    .min(1, { message: 'Podaj przynajmniej jeden email' })
    .max(5, { message: 'Podaj max 5 emaili' }),
})

export type CartSchemaT = z.infer<typeof cartSchema>
