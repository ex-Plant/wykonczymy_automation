import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getDepositTransactionsForInvestment } from '@/lib/db/sum-transfers'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The invariant the client wpłaty figure stands on (EX-557, guarded here by EX-680): COMPANY_FUNDING
// and OTHER_DEPOSIT are company-level cash and can NEVER carry an investment. That is what makes the
// deposit list and any income-bucket aggregate agree for a single investment — remove it and the two
// diverge again, silently.
// The predicate (showsInvestment) and the hook that applies it are already unit-tested; nobody
// asserted the PERSISTED row. So this writes through payload.create — the real hook chain — and reads
// investment_id back out of the table. A plain scan of existing rows would be vacuously green: a prod
// dump contains no such row to begin with.
vi.mock('server-only', () => ({}))
// The sheet-sync hook defers to after(), which needs a request scope and live Google credentials.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('company deposits never persist an investment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let registerId: number

  async function createDeposit(
    type: 'INVESTOR_DEPOSIT' | 'COMPANY_FUNDING' | 'OTHER_DEPOSIT',
    amount: number,
  ): Promise<number> {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        description: `EX-680 ${type}`,
        amount,
        date: '2026-08-12T09:00:00.000Z',
        type,
        paymentMethod: 'TRANSFER',
        sourceRegister: registerId,
        // The whole point: every one of these asks for the investment. Only INVESTOR_DEPOSIT may keep it.
        investment: investmentId,
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return Number(created.id)
  }

  async function persistedInvestmentId(transactionId: number): Promise<number | null> {
    const result = await db.execute(sql`
      SELECT investment_id FROM transactions WHERE id = ${transactionId}
    `)
    const value = result.rows[0]?.investment_id
    return value === null || value === undefined ? null : Number(value)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const registers = await payload.find({
      collection: 'cash-registers',
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    const register = registers.docs[0]
    if (!register) throw new Error('missing cash-register fixture for a deposit')
    registerId = Number(register.id)

    investmentId = await createTestInvestment(payload, 'deposit-investment-invariant-test')
  })

  afterAll(async () => {
    if (investmentId) {
      await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)
      await db.execute(sql`DELETE FROM transactions WHERE description LIKE 'EX-680 %'`)
      await deleteTestInvestment(payload, investmentId)
    }
  })

  it('strips the investment from COMPANY_FUNDING and OTHER_DEPOSIT, keeps it on INVESTOR_DEPOSIT', async () => {
    const [companyFundingId, otherDepositId, investorDepositId] = [
      await createDeposit('COMPANY_FUNDING', 7000),
      await createDeposit('OTHER_DEPOSIT', 1000),
      await createDeposit('INVESTOR_DEPOSIT', 5000),
    ]

    expect(await persistedInvestmentId(companyFundingId)).toBeNull()
    expect(await persistedInvestmentId(otherDepositId)).toBeNull()
    // Positive control: without it the assertions above would also pass on a build that nulls
    // investment_id for every deposit type.
    expect(await persistedInvestmentId(investorDepositId)).toBe(investmentId)
  })

  it('leaves the investment deposit list holding the investor row alone', async () => {
    const rows = await getDepositTransactionsForInvestment(payload, investmentId)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.amount).toBe(5000)
  })
})
