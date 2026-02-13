import type { TransactionRowT } from './types'
import type { TransactionTypeT, PaymentMethodT } from '@/lib/constants/transactions'

/**
 * Maps a Payload transaction document (depth: 1) to a flat TransactionRowT.
 * Handles both populated (object) and non-populated (number) relationship fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTransactionRow(doc: any): TransactionRowT {
  return {
    id: doc.id,
    description: doc.description,
    amount: doc.amount,
    type: doc.type as TransactionTypeT,
    paymentMethod: doc.paymentMethod as PaymentMethodT,
    date: doc.date,
    cashRegisterName: getRelationName(doc.cashRegister),
    investmentName: getRelationName(doc.investment),
    workerName: getRelationName(doc.worker),
    otherCategoryName: getRelationName(doc.otherCategory),
    hasInvoice: doc.invoice != null,
  }
}

function getRelationName(field: unknown): string {
  if (typeof field === 'object' && field !== null && 'name' in field) {
    return (field as { name: string }).name
  }
  return '—'
}
