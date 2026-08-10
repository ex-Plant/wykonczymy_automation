'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { removeTransferInvoiceAction } from '@/lib/actions/transfers'
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
  const [removed, setRemoved] = useState(false)

  const hasInvoice = invoices.length > 0 && !removed

  async function handleRemove(_invoice: InvoiceFileT, closePreview: () => void) {
    if (!confirm('Czy na pewno chcesz usunąć fakturę?')) return
    const result = await removeTransferInvoiceAction(transactionId)
    if (!result.success) {
      toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
      return
    }
    closePreview()
    setRemoved(true)
  }

  return (
    <>
      {hasInvoice ? (
        <InvoicePreviewButton
          invoices={invoices}
          variant="compact"
          onAdd={(closePreview) => {
            closePreview()
            setUploadOpen(true)
          }}
          onRemove={handleRemove}
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
          isReplace={hasInvoice}
        />
      )}
    </>
  )
}
