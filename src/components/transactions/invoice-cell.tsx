'use client'

import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import { InvoiceUploadDialog } from '@/components/dialogs/invoice-upload-dialog'

type InvoiceCellPropsT = {
  readonly transactionId: number
  readonly url: string | null
  readonly filename: string | null
  readonly mimeType: string | null
}

export function InvoiceCell({ transactionId, url, filename, mimeType }: InvoiceCellPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const hasInvoice = !!url

  function handleReplace() {
    setPreviewOpen(false)
    setUploadOpen(true)
  }

  return (
    <>
      {hasInvoice ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPreviewOpen(true)}
          className="text-muted-foreground"
          aria-label={`Podgląd faktury: ${filename ?? 'faktura'}`}
        >
          <FileText />
        </Button>
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

      {hasInvoice && (
        <InvoicePreviewDialog
          url={url!}
          filename={filename}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onReplace={handleReplace}
        />
      )}

      <InvoiceUploadDialog
        transactionId={transactionId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isReplace={hasInvoice}
      />
    </>
  )
}
