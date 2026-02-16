'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import {
  createSettlementSchema,
  zeroSaldoSchema,
  type CreateSettlementFormT,
  type ZeroSaldoFormT,
} from '@/lib/schemas/settlements'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb, sumRegisterBalance, sumInvestmentCosts } from '@/lib/db/sum-transactions'
import { revalidateCollections } from '@/lib/cache/revalidate'
import { perf, perfStart } from '@/lib/perf'

type ActionResultT = { success: true; count?: number } | { success: false; error: string }

export async function createSettlementAction(
  data: CreateSettlementFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  const lineCount = data.lineItems?.length ?? 0
  console.log(`[PERF] createSettlementAction START lineItems=${lineCount}`)

  const user = await perf('settlement.getCurrentUser', () => getCurrentUserJwt())
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  // Validate with server schema
  const parsed = createSettlementSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane'
    return { success: false, error: firstError }
  }

  const hasInvoiceNote = !!parsed.data.invoiceNote

  // Each line item must have either its own invoice file or the global invoiceNote
  for (let i = 0; i < parsed.data.lineItems.length; i++) {
    const file = invoiceFormData?.get(`invoice-${i}`) as File | null
    const hasFile = file && file.size > 0
    if (!hasFile && !hasInvoiceNote) {
      return {
        success: false,
        error: `Pozycja ${i + 1}: wymagana jest faktura lub notatka do faktury`,
      }
    }
  }

  try {
    const payload = await perf('settlement.getPayload', () => getPayload({ config }))

    // Upload invoice files in parallel
    const mediaIds = await perf(
      `settlement.uploadMedia (${parsed.data.lineItems.length} items)`,
      () =>
        Promise.all(
          parsed.data.lineItems.map(async (_, i) => {
            const file = invoiceFormData?.get(`invoice-${i}`) as File | null
            if (file && file.size > 0) {
              const buffer = Buffer.from(await file.arrayBuffer())
              const media = await payload.create({
                collection: 'media',
                file: {
                  data: buffer,
                  mimetype: file.type,
                  name: file.name,
                  size: file.size,
                },
                data: {},
              })
              return media.id
            }
            return undefined
          }),
        ),
    )

    // Create all transactions in parallel, skipping hooks (single recalc at end)
    const created = await perf(
      `settlement.createTransactions (${parsed.data.lineItems.length} items)`,
      async () => {
        const results = await Promise.all(
          parsed.data.lineItems.map((item, i) =>
            payload.create({
              collection: 'transactions',
              data: {
                description: item.description,
                amount: item.amount,
                date: parsed.data.date,
                type: 'EMPLOYEE_EXPENSE',
                paymentMethod: parsed.data.paymentMethod,
                cashRegister: parsed.data.cashRegister,
                investment: parsed.data.investment,
                worker: parsed.data.worker,
                invoice: mediaIds[i],
                invoiceNote: parsed.data.invoiceNote,
                createdBy: user.id,
              },
              context: { skipBalanceRecalc: true },
            }),
          ),
        )
        return results.length
      },
    )

    // Single recalculation for all affected entities (direct SQL, bypasses Payload ORM)
    await perf('settlement.recalcBalances', async () => {
      const db = await getDb(payload)
      const recalcTasks: Promise<unknown>[] = []

      if (parsed.data.cashRegister) {
        const registerId = parsed.data.cashRegister
        recalcTasks.push(
          sumRegisterBalance(payload, registerId).then((balance) =>
            db.execute(sql`
              UPDATE cash_registers SET balance = ${balance}, updated_at = NOW() WHERE id = ${registerId}
            `),
          ),
        )
      }

      if (parsed.data.investment) {
        const investmentId = parsed.data.investment
        recalcTasks.push(
          sumInvestmentCosts(payload, investmentId).then((totalCosts) =>
            db.execute(sql`
              UPDATE investments SET total_costs = ${totalCosts}, updated_at = NOW() WHERE id = ${investmentId}
            `),
          ),
        )
      }

      await Promise.all(recalcTasks)
    })

    revalidateCollections(['transactions', 'cashRegisters'])

    console.log(`[PERF] createSettlementAction TOTAL ${elapsed()}ms (${created} transactions)`)

    return { success: true, count: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}

export async function zeroSaldoAction(data: ZeroSaldoFormT): Promise<ActionResultT> {
  const elapsed = perfStart()
  console.log(`[PERF] zeroSaldoAction START worker=${data.worker}`)

  const user = await perf('zeroSaldo.getCurrentUser', () => getCurrentUserJwt())
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  // Validate with server schema
  const parsed = zeroSaldoSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane'
    return { success: false, error: firstError }
  }

  try {
    const payload = await perf('zeroSaldo.getPayload', () => getPayload({ config }))

    await perf('zeroSaldo.payloadCreate (includes hooks)', () =>
      payload.create({
        collection: 'transactions',
        data: {
          description: 'Zaliczka na poczet wypłaty',
          amount: parsed.data.amount,
          date: new Date().toISOString(),
          type: 'EMPLOYEE_EXPENSE',
          paymentMethod: parsed.data.paymentMethod,
          cashRegister: parsed.data.cashRegister,
          investment: parsed.data.investment,
          worker: parsed.data.worker,
          invoiceNote: 'Zerowanie salda pracownika',
          createdBy: user.id,
        },
      }),
    )

    // Hook already calls revalidateCollections — no duplicate needed

    console.log(`[PERF] zeroSaldoAction TOTAL ${elapsed()}ms`)

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}
