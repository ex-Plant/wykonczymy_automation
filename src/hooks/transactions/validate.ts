import type { CollectionBeforeValidateHook } from 'payload'
import type { Transaction } from '@/payload-types'

type TransactionData = Partial<Transaction>

/**
 * Cross-field validation for Transactions.
 * Enforces required relationships based on transaction type
 * and ensures invoice documentation exists.
 */
export const validateTransaction: CollectionBeforeValidateHook = ({ data, req, operation }) => {
  const d = data as TransactionData
  console.log('[validateTransaction] Start', { operation, type: d.type, amount: d.amount })

  // Auto-set createdBy on create
  if (operation === 'create' && req.user) {
    d.createdBy = req.user.id
  }

  const errors: string[] = []

  // Type-dependent field requirements
  if (d.type === 'INVESTMENT_EXPENSE') {
    if (!d.investment) errors.push('Investment is required for investment expenses.')
  }

  if (d.type === 'ADVANCE') {
    if (!d.worker) errors.push('Worker is required for advances.')
  }

  if (d.type === 'EMPLOYEE_EXPENSE') {
    if (!d.worker) errors.push('Worker is required for employee expenses.')
    if (!d.investment) errors.push('Investment is required for employee expenses.')
  }

  if (d.type === 'OTHER') {
    if (!d.otherCategory) errors.push('Category is required for OTHER transactions.')
  }

  // Invoice or invoiceNote must exist (not required for deposits)
  if (d.type !== 'DEPOSIT' && !d.invoice && !d.invoiceNote) {
    errors.push('Either an invoice file or invoice note is required.')
  }

  if (errors.length > 0) {
    console.log('[validateTransaction] Validation failed:', errors)
    throw new Error(errors.join(' '))
  }

  console.log('[validateTransaction] Passed')
  return d
}
