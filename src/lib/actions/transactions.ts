'use server'

import { revalidateCollections } from '@/lib/cache/revalidate'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { createTransactionSchema, type CreateTransactionFormT } from '@/lib/schemas/transactions'
import { sumRegisterBalance, sumInvestmentCosts } from '@/lib/db/sum-transactions'
import { perf, perfStart } from '@/lib/perf'

type ActionResultT = { success: true } | { success: false; error: string }

type RecalculateResultT =
  | {
      success: true
      message: string
      results: {
        cashRegisters: { id: number; name: string; oldBalance: number; newBalance: number }[]
        investments: { id: number; name: string; oldCosts: number; newCosts: number }[]
      }
    }
  | { success: false; error: string }

export async function createTransactionAction(
  data: CreateTransactionFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const elapsed = perfStart()
  console.log(`[PERF] createTransactionAction START type=${data.type} amount=${data.amount}`)

  const user = await perf('createTransaction.getCurrentUser', () => getCurrentUser())
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  // Validate
  const parsed = createTransactionSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane'
    return { success: false, error: firstError }
  }

  const invoiceFile = invoiceFormData?.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0

  try {
    const payload = await perf('createTransaction.getPayload', () => getPayload({ config }))

    // Upload invoice file if provided
    let mediaId: number | undefined
    if (hasInvoice) {
      const buffer = Buffer.from(await invoiceFile.arrayBuffer())
      const media = await perf('createTransaction.uploadMedia', () =>
        payload.create({
          collection: 'media',
          file: {
            data: buffer,
            mimetype: invoiceFile.type,
            name: invoiceFile.name,
            size: invoiceFile.size,
          },
          data: {},
        }),
      )
      mediaId = media.id
    }

    // Create the transaction (hooks fire inside this call)
    const description = parsed.data.description || 'Wpłata do kasy'

    await perf('createTransaction.payloadCreate (includes hooks)', () =>
      payload.create({
        collection: 'transactions',
        data: {
          ...parsed.data,
          description,
          invoice: mediaId,
          createdBy: user.id,
        },
      }),
    )

    perf('createTransaction.revalidateCollections', async () => {
      revalidateCollections(['transactions', 'cashRegisters'])
    })

    console.log(`[PERF] createTransactionAction TOTAL ${elapsed()}ms`)

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    console.log('[createTransactionAction] Error:', message)
    return { success: false, error: message }
  }
}

export async function recalculateBalancesAction(): Promise<RecalculateResultT> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Brak uprawnień' }
  }

  const payload = await getPayload({ config })
  const results = {
    cashRegisters: [] as { id: number; name: string; oldBalance: number; newBalance: number }[],
    investments: [] as { id: number; name: string; oldCosts: number; newCosts: number }[],
  }

  const registers = await payload.find({ collection: 'cash-registers', pagination: false })
  for (const reg of registers.docs) {
    const newBalance = await sumRegisterBalance(payload, reg.id)
    const oldBalance = reg.balance ?? 0
    if (oldBalance !== newBalance) {
      await payload.update({
        collection: 'cash-registers',
        id: reg.id,
        data: { balance: newBalance },
        context: { skipBalanceRecalc: true },
        overrideAccess: true,
      })
      results.cashRegisters.push({ id: reg.id, name: reg.name, oldBalance, newBalance })
    }
  }

  const investments = await payload.find({ collection: 'investments', pagination: false })
  for (const inv of investments.docs) {
    const newCosts = await sumInvestmentCosts(payload, inv.id)
    const oldCosts = inv.totalCosts ?? 0
    if (oldCosts !== newCosts) {
      await payload.update({
        collection: 'investments',
        id: inv.id,
        data: { totalCosts: newCosts },
        context: { skipBalanceRecalc: true },
        overrideAccess: true,
      })
      results.investments.push({ id: inv.id, name: inv.name, oldCosts, newCosts })
    }
  }

  revalidateCollections(['cashRegisters', 'investments'])

  const fixed = results.cashRegisters.length + results.investments.length
  return {
    success: true,
    message: fixed === 0 ? 'Wszystkie salda są poprawne' : `Naprawiono ${fixed} sald`,
    results,
  }
}

export async function updateTransactionInvoiceAction(
  transactionId: number,
  invoiceFormData: FormData,
): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  const invoiceFile = invoiceFormData.get('invoice') as File | null
  if (!invoiceFile || invoiceFile.size === 0) {
    return { success: false, error: 'Nie wybrano pliku' }
  }

  try {
    const payload = await getPayload({ config })

    const buffer = Buffer.from(await invoiceFile.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      file: {
        data: buffer,
        mimetype: invoiceFile.type,
        name: invoiceFile.name,
        size: invoiceFile.size,
      },
      data: {},
    })

    await payload.update({
      collection: 'transactions',
      id: transactionId,
      data: { invoice: media.id },
    })

    revalidateCollections(['transactions'])

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}
