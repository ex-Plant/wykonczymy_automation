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
  // The open state lives here, so a caller that needs the preview gone (to make room for an upload
  // modal) gets `closePreview` rather than having it forced — a caller may want it to stay open
  // behind a `confirm()`, after a failed delete, or while the previewed file swaps in place.
  onReplace?: (closePreview: () => void) => void
  onRemove?: (closePreview: () => void) => void
} & Pick<InvoicePreviewTriggerPropsT, 'variant' | 'className'>

export function InvoicePreviewButton({
  url,
  filename,
  mimeType,
  onReplace,
  onRemove,
  variant,
  className,
}: InvoicePreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const closePreview = () => setPreviewOpen(false)

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
          onReplace={onReplace && (() => onReplace(closePreview))}
          onRemove={onRemove && (() => onRemove(closePreview))}
          // Stored file is already ingest-compressed (≤1920px, q0.6) — skip the Next optimizer
          // and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
      )}
    </>
  )
}
