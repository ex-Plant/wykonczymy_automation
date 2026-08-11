'use client'

import { useRef } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { useInvoiceRemoval } from '@/hooks/use-invoice-removal'
import { useInvoiceUpload } from '@/hooks/use-invoice-upload'
import type { InvoiceFileT } from '@/types/transfers'

type InvoiceCellPropsT = {
  transactionId: number
  invoices: InvoiceFileT[]
}

export function InvoiceCell({ transactionId, invoices }: InvoiceCellPropsT) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const { isUploading, uploadFiles } = useInvoiceUpload(transactionId)
  const { visibleInvoices, handleRemove, handleRemoveAll } = useInvoiceRemoval(
    transactionId,
    invoices,
  )

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])]
    // Clear the control now that the files are captured: attaching the same photo again after a
    // removal is an ordinary move, and with the value still set the browser fires no change event.
    e.target.value = ''
    void uploadFiles(picked)
  }

  return (
    <>
      {isUploading ? (
        <Button
          variant="ghost"
          size="icon"
          disabled
          className="text-muted-foreground"
          aria-label="Przesyłanie faktury"
        >
          <Loader2 className="animate-spin" />
        </Button>
      ) : visibleInvoices.length > 0 ? (
        <InvoicePreviewButton
          invoices={visibleInvoices}
          variant="compact"
          // The preview covers the picker's own dialog, so it steps aside before the pick.
          onAdd={(closePreview) => {
            closePreview()
            pickerRef.current?.click()
          }}
          onRemove={handleRemove}
          onRemoveAll={visibleInvoices.length > 1 ? handleRemoveAll : undefined}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => pickerRef.current?.click()}
          className="text-muted-foreground"
          aria-label="Dodaj fakturę"
        >
          <Plus />
        </Button>
      )}

      <input
        ref={pickerRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        // `sr-only` clips but keeps the control focusable, so without this a second pick can start
        // mid-upload — and two concurrent read-modify-write attaches lose the first batch's pages.
        disabled={isUploading}
        className="sr-only"
        onChange={handlePicked}
      />
    </>
  )
}
