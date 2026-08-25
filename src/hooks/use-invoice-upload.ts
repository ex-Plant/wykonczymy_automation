'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTransferInvoicesAction } from '@/lib/actions/transfers'
import { reportBlockedFiles } from '@/lib/invoices/blocked-files-message'
import { ingestPickedFiles } from '@/lib/invoices/ingest-picked-files'
import { submitWithInvoicePages } from '@/lib/invoices/submit-with-invoice-pages'
import { toastMessage } from '@/lib/utils/toast'

/**
 * `isUploading` is what the caller needs back: the picker gives no feedback of its own, so without
 * it a slow HEIC convert reads as a click that did nothing.
 */
export function useInvoiceUpload(transactionId: number) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)

  async function attach(picked: File[]) {
    const { files: ready, blocked } = await ingestPickedFiles(picked)
    reportBlockedFiles(blocked)

    if (ready.length === 0) return

    const result = await submitWithInvoicePages(ready, (pageIds) =>
      addTransferInvoicesAction(transactionId, pageIds),
    )
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }

    // Without it the click ends with the cell looking untouched until the refresh lands, which
    // reads as a failed upload and invites a second pick of the same photo.
    toastMessage('Faktura dodana', 'success')
    router.refresh()
  }

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the trigger, or the cell stays disabled until a reload.
  async function uploadFiles(picked: File[]) {
    if (picked.length === 0) return

    setIsUploading(true)
    try {
      await attach(picked)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest/upload failure — capture once Sentry is
      // wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przesłać pliku — spróbuj ponownie.', 'error', 6000)
    } finally {
      setIsUploading(false)
    }
  }

  return { isUploading, uploadFiles }
}
