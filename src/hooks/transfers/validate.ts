import type { CollectionBeforeValidateHook } from 'payload'
import type { Transaction } from '@/payload-types'
import {
  needsSourceRegister,
  requiresInvestment,
  showsInvestment,
  needsTargetRegister,
  needsOtherCategory,
  needsWorker,
  needsExpenseCategory,
  canBeSettled,
} from '@/lib/constants/transfers'
import { getAmountError } from '@/lib/utils/validation'

type TransferData = Partial<Transaction>

export const validateTransfer: CollectionBeforeValidateHook = ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const d = data as TransferData
  console.log('[validateTransfer] Start', { operation, type: d.type, amount: d.amount })

  if (operation === 'create' && req.user) {
    d.createdBy = req.user.id
  }

  const type = d.type ?? ''

  // CANCELLATION rows skip all normal validation — relational fields are null
  if (type === 'CANCELLATION') {
    if (!d.cancelledTransaction) {
      throw new Error('Cancelled transaction reference is required.')
    }
    // The one field the early return may NOT wave through: sumRegisterBalance has no
    // CANCELLATION arm, so a register smuggled in here (REST / Local API — the admin
    // panel no longer offers the picker) lands in `ELSE -amount` and drains it forever.
    d.sourceRegister = null
    return d
  }

  if (operation === 'update' && d.cancelled) {
    return d
  }

  const errors: string[] = []

  // CORRECTION allows negative (invoice credits); every other type must be positive.
  if (d.amount !== undefined && d.amount !== null) {
    const amountErr = getAmountError(d.amount, type)
    if (amountErr) errors.push(amountErr)
  }

  if (needsSourceRegister(type) && !d.sourceRegister) {
    errors.push('Cash register is required for this transfer type.')
  }

  if (!needsSourceRegister(type)) {
    d.sourceRegister = null
  }

  if (requiresInvestment(type) && !d.investment) {
    errors.push('Investment is required for this transfer type.')
  }

  // Auto-clear investment for types that never carry one. deriveFinancials buckets by
  // type, so an investment-linked OTHER lands in no bucket — invisible to marża and
  // bilans while still leaving the register. The form hides the field (showsInvestment),
  // so only the API or a script can plant one; this is the server-side counterpart.
  if (!showsInvestment(type)) {
    d.investment = null
  }

  if (needsTargetRegister(type)) {
    if (!d.targetRegister) {
      errors.push('Target register is required for register transfers.')
    } else if (d.sourceRegister && d.targetRegister === d.sourceRegister) {
      errors.push('Target register must be different from source register.')
    }
  }

  if (needsOtherCategory(type) && !d.otherCategory) {
    errors.push('Category is required for OTHER transfers.')
  }

  if (needsWorker(type) && !d.worker) {
    errors.push('Worker is required for payout transfers.')
  }

  if (!needsWorker(type)) {
    d.worker = null
  }

  // settled (wliczone w robociznę) only applies to material expenses and their
  // corrections — clear it for any other type so the admin panel / API can't persist
  // a stray flag that the reporting layer would mis-bucket.
  if (!canBeSettled(type)) {
    d.settled = false
  }

  if (needsExpenseCategory(type, !!d.investment) && !d.expenseCategory) {
    errors.push('Expense category is required for investment-related expenses.')
  }

  if (errors.length > 0) {
    console.log('[validateTransfer] Validation failed:', errors)
    throw new Error(errors.join(' '))
  }

  console.log('[validateTransfer] Passed')
  return d
}
