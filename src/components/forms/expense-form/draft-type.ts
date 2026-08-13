import { TRANSACTION_TRANSFER_TYPES } from '@/lib/constants/transfers'

const DRAFT_FALLBACK_TYPE = 'INVESTMENT_EXPENSE'

/**
 * The type a restored sessionStorage draft may actually carry into the form. A draft outlives the
 * deploy that removed its type from the dialog, and the Select silently renders empty for a value it
 * has no option for — while the form goes on submitting that value, which the server still accepts
 * (the enum keeps every legacy type on purpose).
 *
 * Falls back rather than clearing the field: an empty type would fail validation on a form the user
 * did not touch, which reads as the app losing their draft.
 */
export function restorableType(type: string): string {
  return (TRANSACTION_TRANSFER_TYPES as string[]).includes(type) ? type : DRAFT_FALLBACK_TYPE
}
