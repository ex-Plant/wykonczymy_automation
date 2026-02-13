import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
  PayloadRequest,
} from 'payload'

const COST_TYPES = ['INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE'] as const

/**
 * Recalculate a cash register's balance by summing all its transactions.
 * Every transaction reduces the register balance (money going out).
 *
 * IMPORTANT: `req` must be forwarded so queries run inside the same
 * database transaction as the triggering operation, avoiding stale reads.
 */
const recalcRegisterBalance = async (
  payload: Payload,
  registerId: number,
  req: PayloadRequest,
): Promise<void> => {
  console.log(`[recalcRegisterBalance] registerId=${registerId}`)

  const { docs } = await payload.find({
    collection: 'transactions',
    where: { cashRegister: { equals: registerId } },
    limit: 0, // all docs
    pagination: false,
    overrideAccess: true,
    req,
  })

  const balance = docs.reduce((sum, tx) => {
    if (tx.type === 'DEPOSIT') return sum + (tx.amount ?? 0)
    return sum - (tx.amount ?? 0)
  }, 0)

  console.log(`[recalcRegisterBalance] registerId=${registerId} txCount=${docs.length} newBalance=${balance}`)

  await payload.update({
    collection: 'cash-registers',
    id: registerId,
    data: { balance },
    context: { skipBalanceRecalc: true },
    overrideAccess: true,
    req,
  })
}

/**
 * Recalculate an investment's totalCosts by summing INVESTMENT_EXPENSE
 * and EMPLOYEE_EXPENSE transactions linked to it.
 */
const recalcInvestmentCosts = async (
  payload: Payload,
  investmentId: number,
  req: PayloadRequest,
): Promise<void> => {
  console.log(`[recalcInvestmentCosts] investmentId=${investmentId}`)

  const { docs } = await payload.find({
    collection: 'transactions',
    where: {
      investment: { equals: investmentId },
      type: { in: [...COST_TYPES] },
    },
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })

  const totalCosts = docs.reduce((sum, tx) => sum + (tx.amount ?? 0), 0)

  console.log(`[recalcInvestmentCosts] investmentId=${investmentId} txCount=${docs.length} totalCosts=${totalCosts}`)

  await payload.update({
    collection: 'investments',
    id: investmentId,
    data: { totalCosts },
    context: { skipBalanceRecalc: true },
    overrideAccess: true,
    req,
  })
}

/** Resolve relationship value to a numeric ID (handles populated objects). */
const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

/**
 * afterChange — recalculate register balance and investment costs
 * after a transaction is created or updated.
 */
export const recalcAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  context,
}) => {
  console.log('[recalcAfterChange] Start', { id: doc.id, type: doc.type, amount: doc.amount })

  if (context.skipBalanceRecalc) {
    console.log('[recalcAfterChange] Skipped (skipBalanceRecalc)')
    return doc
  }

  const registerId = resolveId(doc.cashRegister)
  const prevRegisterId = resolveId(previousDoc?.cashRegister)

  // Recalculate current register
  if (registerId) {
    await recalcRegisterBalance(req.payload, registerId, req)
  }
  // If register changed, recalculate the old one too
  if (prevRegisterId && prevRegisterId !== registerId) {
    await recalcRegisterBalance(req.payload, prevRegisterId, req)
  }

  // Recalculate investment costs if applicable
  const investmentId = resolveId(doc.investment)
  const prevInvestmentId = resolveId(previousDoc?.investment)

  if (investmentId && COST_TYPES.includes(doc.type as (typeof COST_TYPES)[number])) {
    await recalcInvestmentCosts(req.payload, investmentId, req)
  }
  if (prevInvestmentId && prevInvestmentId !== investmentId) {
    await recalcInvestmentCosts(req.payload, prevInvestmentId, req)
  }

  return doc
}

/**
 * afterDelete — recalculate register balance and investment costs
 * after a transaction is deleted.
 */
export const recalcAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  console.log('[recalcAfterDelete] Start', { id: doc.id, type: doc.type, amount: doc.amount })

  const registerId = resolveId(doc.cashRegister)
  if (registerId) {
    await recalcRegisterBalance(req.payload, registerId, req)
  }

  const investmentId = resolveId(doc.investment)
  if (investmentId && COST_TYPES.includes(doc.type as (typeof COST_TYPES)[number])) {
    await recalcInvestmentCosts(req.payload, investmentId, req)
  }

  return doc
}
