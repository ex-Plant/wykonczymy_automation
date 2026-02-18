import { z } from 'zod'
import {
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
  isDepositType,
  needsCashRegister,
  requiresInvestment,
  needsWorker,
  needsTargetRegister,
  needsOtherCategory,
} from '@/lib/constants/transactions'

export const createTransactionSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number().positive('Kwota musi być większa niż 0'),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSACTION_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    cashRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    worker: z.number().optional(),
    otherCategory: z.number().optional(),
    otherDescription: z.string().optional(),
    invoiceNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!isDepositType(data.type) && !data.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Opis jest wymagany',
        path: ['description'],
      })
    }

    if (needsCashRegister(data.type) && !data.cashRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa jest wymagana dla tego typu transferu',
        path: ['cashRegister'],
      })
    }

    if (needsTargetRegister(data.type)) {
      if (!data.targetRegister) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kasa docelowa jest wymagana dla transferu między kasami',
          path: ['targetRegister'],
        })
      } else if (data.cashRegister && data.targetRegister === data.cashRegister) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kasa docelowa musi być inna niż kasa źródłowa',
          path: ['targetRegister'],
        })
      }
    }

    if (requiresInvestment(data.type) && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana dla tego typu transferu',
        path: ['investment'],
      })
    }

    if (needsWorker(data.type) && !data.worker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pracownik jest wymagany dla tego typu transferu',
        path: ['worker'],
      })
    }

    if (needsOtherCategory(data.type) && !data.otherCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kategoria jest wymagana dla transferu typu "Inne"',
        path: ['otherCategory'],
      })
    }
  })

export type CreateTransactionFormT = z.infer<typeof createTransactionSchema>

/**
 * Client-side form validation schema.
 * Works with string values (HTML inputs) — the server schema handles type conversion.
 */
export const transactionFormSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    cashRegister: z.string(),
    targetRegister: z.string(),
    investment: z.string(),
    worker: z.string(),
    otherCategory: z.string(),
    otherDescription: z.string(),
    invoiceNote: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!isDepositType(data.type) && !data.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Opis jest wymagany',
        path: ['description'],
      })
    }

    if (!data.amount || Number(data.amount) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kwota musi być większa niż 0',
        path: ['amount'],
      })
    }

    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data jest wymagana',
        path: ['date'],
      })
    }

    if (needsCashRegister(data.type) && !data.cashRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa jest wymagana dla tego typu transferu',
        path: ['cashRegister'],
      })
    }

    if (needsTargetRegister(data.type)) {
      if (!data.targetRegister) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kasa docelowa jest wymagana dla transferu między kasami',
          path: ['targetRegister'],
        })
      } else if (data.cashRegister && data.targetRegister === data.cashRegister) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kasa docelowa musi być inna niż kasa źródłowa',
          path: ['targetRegister'],
        })
      }
    }

    if (requiresInvestment(data.type) && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana dla tego typu transferu',
        path: ['investment'],
      })
    }

    if (needsWorker(data.type) && !data.worker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pracownik jest wymagany dla tego typu transferu',
        path: ['worker'],
      })
    }

    if (needsOtherCategory(data.type) && !data.otherCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kategoria jest wymagana dla transferu typu "Inne"',
        path: ['otherCategory'],
      })
    }
  })
