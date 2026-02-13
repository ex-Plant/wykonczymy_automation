'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { createTransactionSchema, type CreateTransactionFormT } from './schema'

type SerializedTransactionT = {
  id: number
  description: string
  amount: number
  type: string
  date: string
}

export type EmployeeMonthDataT = {
  transactions: SerializedTransactionT[]
  saldo: number
}

export async function getEmployeeMonthData(
  userId: number,
  month: number,
  year: number,
): Promise<EmployeeMonthDataT> {
  console.log(`[getEmployeeMonthData] userId=${userId} month=${month} year=${year}`)
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')

  // Only allow fetching own data for EMPLOYEE
  if (user.role === 'EMPLOYEE' && user.id !== userId) {
    console.log(`[getEmployeeMonthData] Forbidden: EMPLOYEE ${user.id} tried to access ${userId}`)
    throw new Error('Forbidden')
  }

  const payload = await getPayload({ config })

  // Build date range for the selected month
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59)

  // Fetch monthly transactions + all-time saldo in parallel
  const [monthlyResult, advanceDocs, expenseDocs] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: userId },
        date: {
          greater_than_equal: startDate.toISOString(),
          less_than_equal: endDate.toISOString(),
        },
      },
      sort: '-date',
      limit: 100,
    }),
    // All-time advances for this worker
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: userId },
        type: { equals: 'ADVANCE' },
      },
      limit: 1000,
    }),
    // All-time employee expenses for this worker
    payload.find({
      collection: 'transactions',
      where: {
        worker: { equals: userId },
        type: { equals: 'EMPLOYEE_EXPENSE' },
      },
      limit: 1000,
    }),
  ])

  const advanceSum = advanceDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const expenseSum = expenseDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)

  console.log(
    `[getEmployeeMonthData] txCount=${monthlyResult.docs.length} advances=${advanceSum} expenses=${expenseSum} saldo=${advanceSum - expenseSum}`,
  )

  return {
    transactions: monthlyResult.docs.map((tx) => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
    })),
    saldo: advanceSum - expenseSum,
  }
}

type CreateResultT = { success: true } | { success: false; error: string }

export async function createTransactionAction(
  data: CreateTransactionFormT,
  invoiceFormData: FormData | null,
): Promise<CreateResultT> {
  console.log('[createTransactionAction] Start', {
    type: data.type,
    amount: data.amount,
    cashRegister: data.cashRegister,
  })

  console.log('data', data)

  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    console.log('[createTransactionAction] Unauthorized', { userId: user?.id, role: user?.role })
    return { success: false, error: 'Brak uprawnień' }
  }

  // Validate
  const parsed = createTransactionSchema.safeParse(data)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane'
    console.log('[createTransactionAction] Zod validation failed:', parsed.error.issues)
    return { success: false, error: firstError }
  }

  const invoiceFile = invoiceFormData?.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0
  const hasInvoiceNote = !!parsed.data.invoiceNote

  console.log('[createTransactionAction] Invoice check', {
    hasInvoice,
    hasInvoiceNote,
    type: parsed.data.type,
  })

  console.log('createTransactionAction', parsed.data)
  // Either invoice or invoiceNote must exist (not required for deposits)
  if (parsed.data.type !== 'DEPOSIT' && !hasInvoice && !hasInvoiceNote) {
    console.log('[createTransactionAction] Missing invoice/note for non-DEPOSIT')
    return { success: false, error: 'Wymagana jest faktura lub notatka do faktury' }
  }

  try {
    const payload = await getPayload({ config })

    // Upload invoice file if provided
    let mediaId: number | undefined
    if (hasInvoice) {
      console.log('[createTransactionAction] Uploading invoice', {
        name: invoiceFile.name,
        size: invoiceFile.size,
      })
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
      mediaId = media.id
    }

    // Create the transaction
    const description = parsed.data.description || 'Wpłata do kasy'

    await payload.create({
      collection: 'transactions',
      data: {
        ...parsed.data,
        description,
        invoice: mediaId,
        createdBy: user.id,
      },
    })

    console.log('[createTransactionAction] Transaction created successfully')

    revalidatePath('/')
    revalidatePath('/transakcje')
    revalidatePath('/kasa')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    console.log('[createTransactionAction] Error:', message)
    return { success: false, error: message }
  }
}
