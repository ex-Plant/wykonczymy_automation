'use server'

import { revalidateCollections } from '@/lib/cache/revalidate'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import {
  createSettlementSchema,
  zeroSaldoSchema,
  type CreateSettlementFormT,
  type ZeroSaldoFormT,
} from '@/lib/schemas/settlements'

type ActionResultT = { success: true; count?: number } | { success: false; error: string }

export async function createSettlementAction(
  data: CreateSettlementFormT,
  invoiceFormData: FormData | null,
): Promise<ActionResultT> {
  const user = await getCurrentUser()
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
    const payload = await getPayload({ config })

    // Upload invoice files per line item
    const mediaIds: (number | undefined)[] = []
    for (let i = 0; i < parsed.data.lineItems.length; i++) {
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
        mediaIds.push(media.id)
      } else {
        mediaIds.push(undefined)
      }
    }

    // Create N EMPLOYEE_EXPENSE transactions
    let created = 0
    for (let i = 0; i < parsed.data.lineItems.length; i++) {
      const item = parsed.data.lineItems[i]
      try {
        await payload.create({
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
        })
        created++
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Wystąpił błąd'
        return {
          success: false,
          error: `Utworzono ${created} z ${parsed.data.lineItems.length} transakcji. Błąd: ${message}`,
        }
      }
    }

    revalidateCollections(['transactions', 'cashRegisters'])

    return { success: true, count: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}

export async function zeroSaldoAction(data: ZeroSaldoFormT): Promise<ActionResultT> {
  const user = await getCurrentUser()
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
    const payload = await getPayload({ config })

    await payload.create({
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
    })

    revalidateCollections(['transactions', 'cashRegisters'])

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    return { success: false, error: message }
  }
}
