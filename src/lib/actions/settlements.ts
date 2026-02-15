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

  // Either invoice file or invoiceNote must exist
  const invoiceFile = invoiceFormData?.get('invoice') as File | null
  const hasInvoice = invoiceFile && invoiceFile.size > 0
  const hasInvoiceNote = !!parsed.data.invoiceNote

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
    for (const item of parsed.data.lineItems) {
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
            invoice: mediaId,
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
