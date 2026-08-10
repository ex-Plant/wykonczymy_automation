'use client'

import { useState } from 'react'
import {
  removeAllTransferInvoicesAction,
  removeTransferInvoiceAction,
} from '@/lib/actions/transfers'
import { toastMessage } from '@/lib/utils/toast'
import type { InvoiceFileT } from '@/types/transfers'

/**
 * Page removal for one expense's invoice, shared by every surface that shows the preview with a
 * „usuń" affordance (the transfers cell, the edit form). The optimistic set is what makes it a hook
 * rather than a helper: the server row doesn't refresh until the table revalidates, so removing one
 * page of three has to hide that page locally, per id.
 */
export function useInvoiceRemoval(transactionId: number, invoices: InvoiceFileT[]) {
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())

  const visibleInvoices = invoices.filter(
    (invoice) => invoice.id === undefined || !removedIds.has(invoice.id),
  )

  async function handleRemove(invoice: InvoiceFileT, closePreview: () => void) {
    if (invoice.id === undefined) return

    // Removing the only page removes the invoice — say that, rather than „stronę" for a single photo.
    const isLastPage = visibleInvoices.length === 1
    const confirmed = confirm(
      isLastPage ? 'Czy na pewno chcesz usunąć fakturę?' : 'Czy na pewno chcesz usunąć tę stronę?',
    )
    if (!confirmed) return

    const result = await removeTransferInvoiceAction(transactionId, invoice.id)
    if (!result.success) {
      toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
      return
    }

    const removedId = invoice.id
    setRemovedIds((previous) => new Set(previous).add(removedId))
    if (isLastPage) closePreview()
  }

  async function handleRemoveAll(closePreview: () => void) {
    if (!confirm('Czy na pewno chcesz usunąć całą fakturę?')) return

    const result = await removeAllTransferInvoicesAction(transactionId)
    if (!result.success) {
      toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
      return
    }

    closePreview()
    setRemovedIds(new Set(invoices.map((invoice) => invoice.id).filter((id) => id !== undefined)))
  }

  return { visibleInvoices, handleRemove, handleRemoveAll }
}
