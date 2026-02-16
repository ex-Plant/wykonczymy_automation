import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
  PayloadRequest,
} from 'payload'
import { sumRegisterBalance, sumInvestmentCosts } from '@/lib/db/sum-transactions'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { perf } from '@/lib/perf'

const COST_TYPES = ['INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE'] as const

/**
 * Recalculate a cash register's balance via SQL SUM aggregation.
 *
 * IMPORTANT: `req` must be forwarded so the query runs inside the same
 * database transaction as the triggering operation, avoiding stale reads.
 */
const recalcRegisterBalance = async (
  payload: Payload,
  registerId: number,
  req: PayloadRequest,
): Promise<void> => {
  const balance = await perf(`hook.sumRegisterBalance(${registerId})`, () =>
    sumRegisterBalance(payload, registerId, req),
  )

  await perf(`hook.updateCashRegister(${registerId})`, () =>
    payload.update({
      collection: 'cash-registers',
      id: registerId,
      data: { balance },
      context: { skipBalanceRecalc: true },
      overrideAccess: true,
      req,
    }),
  )
}

/**
 * Recalculate an investment's totalCosts via SQL SUM aggregation.
 * Only INVESTMENT_EXPENSE and EMPLOYEE_EXPENSE transactions count.
 */
const recalcInvestmentCosts = async (
  payload: Payload,
  investmentId: number,
  req: PayloadRequest,
): Promise<void> => {
  const totalCosts = await perf(`hook.sumInvestmentCosts(${investmentId})`, () =>
    sumInvestmentCosts(payload, investmentId, req),
  )

  await perf(`hook.updateInvestment(${investmentId})`, () =>
    payload.update({
      collection: 'investments',
      id: investmentId,
      data: { totalCosts },
      context: { skipBalanceRecalc: true },
      overrideAccess: true,
      req,
    }),
  )
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
  const hookStart = performance.now()
  console.log(`[PERF] recalcAfterChange START id=${doc.id} type=${doc.type}`)

  if (context.skipBalanceRecalc) {
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

  const revalStart = performance.now()
  revalidateCollections(['transactions', 'cashRegisters'])
  console.log(`[PERF] hook.revalidateCollections ${(performance.now() - revalStart).toFixed(1)}ms`)

  console.log(`[PERF] recalcAfterChange TOTAL ${(performance.now() - hookStart).toFixed(1)}ms`)

  return doc
}

/**
 * afterDelete — recalculate register balance and investment costs
 * after a transaction is deleted.
 */
export const recalcAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const hookStart = performance.now()
  console.log(`[PERF] recalcAfterDelete START id=${doc.id} type=${doc.type}`)

  const registerId = resolveId(doc.cashRegister)
  if (registerId) {
    await recalcRegisterBalance(req.payload, registerId, req)
  }

  const investmentId = resolveId(doc.investment)
  if (investmentId && COST_TYPES.includes(doc.type as (typeof COST_TYPES)[number])) {
    await recalcInvestmentCosts(req.payload, investmentId, req)
  }

  revalidateCollections(['transactions', 'cashRegisters'])

  console.log(`[PERF] recalcAfterDelete TOTAL ${(performance.now() - hookStart).toFixed(1)}ms`)

  return doc
}
