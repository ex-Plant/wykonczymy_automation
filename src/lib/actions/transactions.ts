'use server'

import { revalidateCollections } from '@/lib/cache/revalidate'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { createTransactionSchema, type CreateTransactionFormT } from '@/lib/transactions/schema'

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

    revalidateCollections(['transactions', 'cashRegisters'])

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd'
    console.log('[createTransactionAction] Error:', message)
    return { success: false, error: message }
  }
}
