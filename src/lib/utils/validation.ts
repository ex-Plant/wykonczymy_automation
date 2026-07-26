import { z } from 'zod'
import { billsNetAmount } from '@/lib/constants/transfers'

/**
 * Returns an error message if the amount is invalid for the given type, or undefined if valid.
 * CORRECTION requires negative amounts (invoice corrections reduce costs).
 */
export function getAmountError(amount: number, type: string): string | undefined {
  if (type === 'CORRECTION') {
    return amount >= 0 ? 'Korekta musi mieć ujemną kwotę' : undefined
  }
  return amount <= 0 ? 'Kwota musi być większa niż 0' : undefined
}

/**
 * The netto figure a line bills the investor, checked for the type whose spec row bills at it —
 * and only that type. Above brutto it would bill more than left the kasa; missing it would bill 0
 * (the billed-total helper never falls back to brutto). One home for all three planes: the client
 * form schema, the server create schema, and the Payload hook.
 */
export function getNetAmountError(
  netAmount: number | null | undefined,
  amount: number | null | undefined,
  type: string,
): string | undefined {
  if (!billsNetAmount(type)) return undefined
  if (netAmount == null || Number.isNaN(netAmount)) return 'Kwota netto jest wymagana'
  if (netAmount <= 0) return 'Kwota netto musi być większa niż 0'
  if (amount != null && !Number.isNaN(amount) && netAmount > amount) {
    return 'Kwota netto nie może przekraczać kwoty brutto'
  }
  return undefined
}

/** Validates that a string amount is present and valid for the given type (Zod refinement). */
export function refineAmount(data: { amount: string; type?: string }, ctx: z.RefinementCtx) {
  if (!data.amount) {
    ctx.addIssue({
      code: 'custom',
      message: 'Kwota musi być większa niż 0',
      path: ['amount'],
    })
    return
  }
  const error = getAmountError(Number(data.amount), data.type ?? '')
  if (error) {
    ctx.addIssue({
      code: 'custom',
      message: error,
      path: ['amount'],
    })
  }
}

/** Validates that a string date is present. */
export function refineDate(data: { date: string }, ctx: z.RefinementCtx) {
  if (!data.date) {
    ctx.addIssue({
      code: 'custom',
      message: 'Data jest wymagana',
      path: ['date'],
    })
  }
}
