'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewTrigger } from '@/components/ui/invoice-preview-trigger'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [removed, setRemoved] = useState(false)

  const hasInvoice = !!url && !removed

  function handleReplace() {
    setPreviewOpen(false)
    setUploadOpen(true)
  }

  async function handleRemove() {
    if (!confirm('Czy na pewno chcesz usunąć fakturę?')) return
    const result = await removeTransferInvoiceAction(transactionId)
    if (result.success) {
      setPreviewOpen(false)
      setRemoved(true)
    } else {
      toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
    }
  }

  return (
    <>
      {hasInvoice ? (
        <InvoicePreviewTrigger
          isImage={mimeType?.startsWith('image/') ?? false}
          label={filename ?? 'faktura'}
          onClick={() => setPreviewOpen(true)}
          variant="compact"
          className="size-9"
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

      {url && previewOpen && (
        <InvoicePreviewDialog
          url={url}
          filename={filename}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onReplace={handleReplace}
          onRemove={handleRemove}
          // Stored file is already ingest-compressed (≤1920px, q0.6) — skip the Next optimizer
          // and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
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
