'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { InvoicePreviewDialog } from './invoice-preview-dialog'

type InvoiceCellPropsT = {
  readonly url: string
  readonly filename: string | null
  readonly mimeType: string | null
}

export function InvoiceCell({ url, filename, mimeType }: InvoiceCellPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center transition-colors"
        aria-label={`Podgląd faktury: ${filename ?? 'faktura'}`}
      >
        <FileText className="size-4" />
      </button>
      <InvoicePreviewDialog
        url={url}
        filename={filename}
        mimeType={mimeType}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
