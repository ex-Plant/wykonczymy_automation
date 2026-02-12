import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload } from 'payload'

const COST_TYPES = ['INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE'] as const

/**
 * Recalculate a cash register's balance by summing all its transactions.
 * Every transaction reduces the register balance (money going out).
 */
const recalcRegisterBalance = async (payload: Payload, registerId: number): Promise<void> => {
  const { docs } = await payload.find({
    collection: 'transactions',
    where: { cashRegister: { equals: registerId } },
    limit: 0, // all docs
    pagination: false,
  })

  const balance = docs.reduce((sum, tx) => sum - (tx.amount ?? 0), 0)

  await payload.update({
    collection: 'cash-registers',
    id: registerId,
    data: { balance },
    context: { skipBalanceRecalc: true },
  })
}

/**
 * Recalculate an investment's totalCosts by summing INVESTMENT_EXPENSE
 * and EMPLOYEE_EXPENSE transactions linked to it.
 */
const recalcInvestmentCosts = async (payload: Payload, investmentId: number): Promise<void> => {
  const { docs } = await payload.find({
    collection: 'transactions',
    where: {
      investment: { equals: investmentId },
      type: { in: [...COST_TYPES] },
    },
    limit: 0,
    pagination: false,
  })

  const totalCosts = docs.reduce((sum, tx) => sum + (tx.amount ?? 0), 0)

  await payload.update({
    collection: 'investments',
    id: investmentId,
    data: { totalCosts },
    context: { skipBalanceRecalc: true },
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
  if (context.skipBalanceRecalc) return doc

  const registerId = resolveId(doc.cashRegister)
  const prevRegisterId = resolveId(previousDoc?.cashRegister)

  // Recalculate current register
  if (registerId) {
    await recalcRegisterBalance(req.payload, registerId)
  }
  // If register changed, recalculate the old one too
  if (prevRegisterId && prevRegisterId !== registerId) {
    await recalcRegisterBalance(req.payload, prevRegisterId)
  }

  // Recalculate investment costs if applicable
  const investmentId = resolveId(doc.investment)
  const prevInvestmentId = resolveId(previousDoc?.investment)

  if (investmentId && COST_TYPES.includes(doc.type as (typeof COST_TYPES)[number])) {
    await recalcInvestmentCosts(req.payload, investmentId)
  }
  if (prevInvestmentId && prevInvestmentId !== investmentId) {
    await recalcInvestmentCosts(req.payload, prevInvestmentId)
  }

  return doc
}

/**
 * afterDelete — recalculate register balance and investment costs
 * after a transaction is deleted.
 */
export const recalcAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const registerId = resolveId(doc.cashRegister)
  if (registerId) {
    await recalcRegisterBalance(req.payload, registerId)
  }

  const investmentId = resolveId(doc.investment)
  if (investmentId && COST_TYPES.includes(doc.type as (typeof COST_TYPES)[number])) {
    await recalcInvestmentCosts(req.payload, investmentId)
  }

  return doc
}
