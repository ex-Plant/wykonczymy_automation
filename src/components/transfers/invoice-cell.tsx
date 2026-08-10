'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import {
  removeAllTransferInvoicesAction,
  removeTransferInvoiceAction,
} from '@/lib/actions/transfers'
import { toastMessage } from '@/lib/utils/toast'
import type { InvoiceFileT } from '@/types/transfers'

const InvoiceUploadDialog = dynamic(() =>
  import('@/components/dialogs/invoice-upload-dialog').then((m) => ({
    default: m.InvoiceUploadDialog,
  })),
)

type InvoiceCellPropsT = {
  transactionId: number
  invoices: InvoiceFileT[]
}

export function InvoiceCell({ transactionId, invoices }: InvoiceCellPropsT) {
  const [uploadOpen, setUploadOpen] = useState(false)
  // Per-id, not a boolean: removing one page of three must hide that page only, and the row's
  // server data doesn't refresh until the table revalidates.
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

  return (
    <>
      {visibleInvoices.length > 0 ? (
        <InvoicePreviewButton
          invoices={visibleInvoices}
          variant="compact"
          onAdd={(closePreview) => {
            closePreview()
            setUploadOpen(true)
          }}
          onRemove={handleRemove}
          onRemoveAll={visibleInvoices.length > 1 ? handleRemoveAll : undefined}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setUploadOpen(true)}
          className="text-muted-foreground"
          aria-label="Dodaj fakturę"
        >
          <Plus />
        </Button>
      )}

      {uploadOpen && (
        <InvoiceUploadDialog
          transactionId={transactionId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
        />
      )}
    </>
  )
}
