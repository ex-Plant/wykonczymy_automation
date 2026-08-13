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
  billsNetAmount,
} from '@/lib/constants/transfers'
import { getAmountError, getNetAmountError } from '@/lib/utils/validation'

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

  const original = originalDoc as TransferData | undefined

  // Fall back to the stored row throughout: a partial update (PATCH of one field) carries no
  // `type`, and an empty one would route a netto row down the else-branch below and null its
  // netAmount. The same holds for every relational field the required-checks read — an
  // invoice-only PATCH would otherwise be rejected for fields the row has carried all along.
  // Keyed on PRESENCE, not on truthiness: an explicit `null` is a CLEAR — the admin panel saves the
  // whole document, so that is how a wiped relationship arrives — and it must reach the
  // required-checks as the empty value it is, not silently read the old link off the stored row.
  const resolved = <K extends keyof TransferData>(field: K) =>
    field in d ? d[field] : original?.[field]

  const type = resolved('type') ?? ''
  const sourceRegister = resolved('sourceRegister')
  const investment = resolved('investment')
  const targetRegister = resolved('targetRegister')
  const otherCategory = resolved('otherCategory')
  const worker = resolved('worker')
  const expenseCategory = resolved('expenseCategory')

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

  if (needsSourceRegister(type) && !sourceRegister) {
    errors.push('Cash register is required for this transfer type.')
  }

  if (!needsSourceRegister(type)) {
    d.sourceRegister = null
  }

  if (requiresInvestment(type) && !investment) {
    errors.push('Investment is required for this transfer type.')
  }

  // Auto-clear investment for types that never carry one — two distinct reasons, one rule.
  // For OTHER / REGISTER_TRANSFER the investment is invisible: deriveFinancials buckets by
  // type, so the row lands in no bucket while still leaving the register. For the two
  // company deposits it is worse than invisible — they DO bucket as income, so an
  // investment would silently raise that investment's bilans with company-level cash
  // (EX-557). The forms hide the field, so only the API or a script can plant one; this is
  // the server-side counterpart.
  if (!showsInvestment(type)) {
    d.investment = null
  }

  if (needsTargetRegister(type)) {
    if (!targetRegister) {
      errors.push('Target register is required for register transfers.')
    } else if (sourceRegister && targetRegister === sourceRegister) {
      errors.push('Target register must be different from source register.')
    }
  }

  if (needsOtherCategory(type) && !otherCategory) {
    errors.push('Category is required for OTHER transfers.')
  }

  if (needsWorker(type) && !worker) {
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

  // The netto figure is load-bearing exactly on the type whose spec row bills at `netAmount`, and
  // meaningless anywhere else — so the type that doesn't bill at it stores null. This hook is the
  // server-side authority; the rule itself lives once in getNetAmountError.
  // The numerics stay on `??` rather than `resolved()`: unlike a relationship, a money field has no
  // "cleared" state — an explicit null on a required amount is the absence the stored row must fill,
  // not an erasure to validate against.
  if (billsNetAmount(type)) {
    const netErr = getNetAmountError(
      d.netAmount ?? original?.netAmount,
      d.amount ?? original?.amount,
      type,
    )
    if (netErr) errors.push(netErr)
  } else {
    d.netAmount = null
  }

  if (needsExpenseCategory(type, !!investment) && !expenseCategory) {
    errors.push('Expense category is required for investment-related expenses.')
  }

  if (errors.length > 0) {
    console.log('[validateTransfer] Validation failed:', errors)
    throw new Error(errors.join(' '))
  }

  console.log('[validateTransfer] Passed')
  return d
}
