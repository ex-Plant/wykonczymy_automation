'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import type { PaymentMethodT } from '@/lib/constants/transactions'

type SaldoResultT = { saldo: number }

type ActionResultT = { success: true; count?: number } | { success: false; error: string }

type LineItemT = { description: string; amount: string }

export async function getEmployeeSaldo(workerId: number): Promise<SaldoResultT> {
  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    throw new Error('Brak uprawnień')
  }

  const payload = await getPayload({ config })

  const [advanceDocs, expenseDocs] = await Promise.all([
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: workerId }, type: { equals: 'ADVANCE' } },
      limit: 1000,
      depth: 0,
    }),
    payload.find({
      collection: 'transactions',
      where: { worker: { equals: workerId }, type: { equals: 'EMPLOYEE_EXPENSE' } },
      limit: 1000,
      depth: 0,
    }),
  ])

  const advanceSum = advanceDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const expenseSum = expenseDocs.docs.reduce((sum, tx) => sum + tx.amount, 0)

  return { saldo: advanceSum - expenseSum }
}

export async function createSettlement(formData: FormData): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  const worker = Number(formData.get('worker'))
  const investment = Number(formData.get('investment'))
  const date = formData.get('date') as string
  const cashRegister = Number(formData.get('cashRegister'))
  const paymentMethod = formData.get('paymentMethod') as PaymentMethodT
  const invoiceNote = (formData.get('invoiceNote') as string) || undefined
  const lineItemsRaw = formData.get('lineItems') as string

  // Validate required shared fields
  if (!worker || !date || !cashRegister || !paymentMethod) {
    return { success: false, error: 'Wypełnij wszystkie wymagane pola' }
  }

  // Parse line items
  let lineItems: LineItemT[]
  try {
    lineItems = JSON.parse(lineItemsRaw)
  } catch {
    return { success: false, error: 'Nieprawidłowe dane pozycji' }
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return { success: false, error: 'Dodaj co najmniej jedną pozycję' }
  }

  // Validate each line item
  for (const item of lineItems) {
    if (!item.description.trim()) {
      return { success: false, error: 'Wszystkie pozycje muszą mieć opis' }
    }
    if (!item.amount || Number(item.amount) <= 0) {
      return { success: false, error: 'Wszystkie kwoty muszą być większe niż 0' }
    }
  }

  // Either invoice file or invoiceNote must exist
  const invoiceFile = formData.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0
  const hasInvoiceNote = !!invoiceNote

  if (!hasInvoice && !hasInvoiceNote) {
    return { success: false, error: 'Wymagana jest faktura lub notatka do faktury' }
  }

  try {
    const payload = await getPayload({ config })

    // Upload invoice file once if provided
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

    // Create N EMPLOYEE_EXPENSE transactions
    let created = 0
    for (const item of lineItems) {
      try {
        await payload.create({
          collection: 'transactions',
          data: {
            description: item.description,
            amount: Number(item.amount),
            date,
            type: 'EMPLOYEE_EXPENSE',
            paymentMethod,
            cashRegister,
            investment,
            worker,
            invoice: mediaId,
            invoiceNote,
            createdBy: user.id,
          },
        })
        created++
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Wystąpił błąd'
        return {
          success: false,
          error: `Utworzono ${created} z ${lineItems.length} transakcji. Błąd: ${message}`,
        }
      }
    }

    revalidatePath('/')
    revalidatePath('/transakcje')
    revalidatePath('/uzytkownicy')

    return { success: true, count: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}

export async function zeroSaldoAction(formData: FormData): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user || !isManagementRole(user.role)) {
    return { success: false, error: 'Brak uprawnień' }
  }

  const worker = Number(formData.get('worker'))
  const investment = Number(formData.get('investment'))
  const cashRegister = Number(formData.get('cashRegister'))
  const paymentMethod = formData.get('paymentMethod') as PaymentMethodT
  const amount = Number(formData.get('amount'))

  if (!worker || !investment || !cashRegister || !paymentMethod || !amount || amount <= 0) {
    return { success: false, error: 'Wypełnij wszystkie wymagane pola' }
  }

  try {
    const payload = await getPayload({ config })

    await payload.create({
      collection: 'transactions',
      data: {
        description: 'Zaliczka na poczet wypłaty',
        amount,
        date: new Date().toISOString(),
        type: 'EMPLOYEE_EXPENSE',
        paymentMethod,
        cashRegister,
        investment,
        worker,
        invoiceNote: 'Zerowanie salda pracownika',
        createdBy: user.id,
      },
    })

    revalidatePath('/')
    revalidatePath('/transakcje')
    revalidatePath('/uzytkownicy')

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}
