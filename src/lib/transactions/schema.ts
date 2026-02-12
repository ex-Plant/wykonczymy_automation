import { z } from 'zod'
import {
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
  needsInvestment,
  needsWorker,
  needsOtherCategory,
} from '@/lib/constants/transactions'

export const createTransactionSchema = z
  .object({
    description: z.string().min(1, 'Opis jest wymagany'),
    amount: z.number().positive('Kwota musi być większa niż 0'),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSACTION_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    cashRegister: z.number({ error: 'Kasa jest wymagana' }),
    investment: z.number().optional(),
    worker: z.number().optional(),
    otherCategory: z.number().optional(),
    otherDescription: z.string().optional(),
    invoiceNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (needsInvestment(data.type) && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana dla tego typu transakcji',
        path: ['investment'],
      })
    }

    if (needsWorker(data.type) && !data.worker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pracownik jest wymagany dla tego typu transakcji',
        path: ['worker'],
      })
    }

    if (needsOtherCategory(data.type) && !data.otherCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kategoria jest wymagana dla transakcji typu "Inne"',
        path: ['otherCategory'],
      })
    }
  })

export type CreateTransactionFormT = z.infer<typeof createTransactionSchema>
