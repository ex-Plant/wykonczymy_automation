'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { createTransactionSchema } from './schema'

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
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')

  // Only allow fetching own data for EMPLOYEE
  if (user.role === 'EMPLOYEE' && user.id !== userId) {
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

export async function createTransactionAction(formData: FormData): Promise<CreateResultT> {
  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  // Extract fields from FormData
  const raw = {
    description: formData.get('description') as string,
    amount: Number(formData.get('amount')),
    date: formData.get('date') as string,
    type: formData.get('type') as string,
    paymentMethod: formData.get('paymentMethod') as string,
    cashRegister: Number(formData.get('cashRegister')),
    investment: formData.get('investment') ? Number(formData.get('investment')) : undefined,
    worker: formData.get('worker') ? Number(formData.get('worker')) : undefined,
    otherCategory: formData.get('otherCategory')
      ? Number(formData.get('otherCategory'))
      : undefined,
    otherDescription: (formData.get('otherDescription') as string) || undefined,
    invoiceNote: (formData.get('invoiceNote') as string) || undefined,
  }

  // Validate
  const parsed = createTransactionSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane'
    return { success: false, error: firstError }
  }

  const invoiceFile = formData.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0
  const hasInvoiceNote = !!parsed.data.invoiceNote

  // Either invoice or invoiceNote must exist
  if (!hasInvoice && !hasInvoiceNote) {
    return { success: false, error: 'Wymagana jest faktura lub notatka do faktury' }
  }

  try {
    const payload = await getPayload({ config })

    // Upload invoice file if provided
    let mediaId: number | undefined
    if (hasInvoice) {
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
    await payload.create({
      collection: 'transactions',
      data: {
        ...parsed.data,
        invoice: mediaId,
        createdBy: user.id,
      },
    })

    revalidatePath('/')
    revalidatePath('/transakcje')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}
