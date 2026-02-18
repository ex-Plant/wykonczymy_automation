import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants/transactions'

// ---------------------------------------------------------------------------
// Settlement form
// ---------------------------------------------------------------------------

const lineItemClientSchema = z.object({
  description: z.string(),
  amount: z.string(),
})

/** Client-side schema — works with string values from HTML inputs. */
export const settlementFormSchema = z
  .object({
    worker: z.string(),
    investment: z.string(),
    date: z.string(),
    paymentMethod: z.string(),
    invoiceNote: z.string(),
    lineItems: z.array(lineItemClientSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.worker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pracownik jest wymagany',
        path: ['worker'],
      })
    }

    if (!data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }

    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data jest wymagana',
        path: ['date'],
      })
    }

    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
      })
    }

    data.lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opis jest wymagany',
          path: ['lineItems', index, 'description'],
        })
      }
      if (!item.amount || Number(item.amount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['lineItems', index, 'amount'],
        })
      }
    })
  })

/** Server-side schema — typed values after conversion. */
export const createSettlementSchema = z.object({
  worker: z.number({ error: 'Pracownik jest wymagany' }).positive('Pracownik jest wymagany'),
  investment: z.number({ error: 'Inwestycja jest wymagana' }).positive('Inwestycja jest wymagana'),
  date: z.string().min(1, 'Data jest wymagana'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  invoiceNote: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Opis jest wymagany'),
        amount: z.number().positive('Kwota musi być większa niż 0'),
      }),
    )
    .min(1, 'Dodaj co najmniej jedną pozycję'),
})

export type CreateSettlementFormT = z.infer<typeof createSettlementSchema>

// ---------------------------------------------------------------------------
// Zero-saldo
// ---------------------------------------------------------------------------

/** Client-side schema — string values from HTML selects. */
export const zeroSaldoFormSchema = z
  .object({
    investment: z.string(),
    paymentMethod: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }
  })

/** Server-side schema — typed values. */
export const zeroSaldoSchema = z.object({
  worker: z.number({ error: 'Pracownik jest wymagany' }).positive('Pracownik jest wymagany'),
  investment: z.number({ error: 'Inwestycja jest wymagana' }).positive('Inwestycja jest wymagana'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  amount: z.number().positive('Kwota musi być większa niż 0'),
})

export type ZeroSaldoFormT = z.infer<typeof zeroSaldoSchema>
