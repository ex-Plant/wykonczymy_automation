'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { useInvoiceRemoval } from '@/hooks/use-invoice-removal'
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
  const { visibleInvoices, handleRemove, handleRemoveAll } = useInvoiceRemoval(
    transactionId,
    invoices,
  )

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
