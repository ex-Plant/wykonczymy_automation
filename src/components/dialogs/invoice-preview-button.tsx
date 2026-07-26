'use client'

import { useState } from 'react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import {
  InvoicePreviewTrigger,
  type InvoicePreviewTriggerPropsT,
} from '@/components/ui/invoice-preview-trigger'

type InvoicePreviewButtonPropsT = {
  url: string
  filename: string | null
  mimeType: string | null
} & Pick<InvoicePreviewTriggerPropsT, 'variant' | 'className'>

export function InvoicePreviewButton({
  url,
  filename,
  mimeType,
  variant,
  className,
}: InvoicePreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <InvoicePreviewTrigger
        mimeType={mimeType}
        label={filename ?? 'Faktura'}
        onClick={() => setPreviewOpen(true)}
        variant={variant}
        className={className}
      />

      {previewOpen && (
        <InvoicePreviewDialog
          url={url}
          filename={filename}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          // Stored file is already ingest-compressed (≤1920px, q0.6) — skip the Next optimizer
          // and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
      )}
    </>
  )
}
