'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { removeTransferInvoiceAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/lib/utils/toast'

const InvoiceUploadDialog = dynamic(() =>
  import('@/components/dialogs/invoice-upload-dialog').then((m) => ({
    default: m.InvoiceUploadDialog,
  })),
)

type InvoiceCellPropsT = {
  transactionId: number
  url: string | null
  filename: string | null
  mimeType: string | null
}

export function InvoiceCell({ transactionId, url, filename, mimeType }: InvoiceCellPropsT) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [removed, setRemoved] = useState(false)

  const hasInvoice = !!url && !removed

  async function handleRemove(closePreview: () => void) {
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
          url={url}
          filename={filename}
          mimeType={mimeType}
          variant="compact"
          onReplace={(closePreview) => {
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
