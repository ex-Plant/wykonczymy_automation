'use client'

import { useTransition } from 'react'
import type { Where } from 'payload'
import { FileArchive, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { useInvoiceZip } from '@/components/transfers/use-invoice-zip'
import { fetchFilteredTransfers } from '@/lib/actions/export'
import { buildInvoiceArchiveName } from '@/lib/export/invoice-zip'

type InvoiceDownloadButtonPropsT = {
  where: Where
}

// Job 1 of the export: get the rows. Packing them into the archive belongs to `useInvoiceZip`, shared
// with the kosztorys Wydatki list.
export function InvoiceDownloadButton({ where }: InvoiceDownloadButtonPropsT) {
  const { download, isPending: isZipping } = useInvoiceZip()
  // Covers the row fetch, which happens before the hook's own transition (and its toast) starts —
  // without it the button would sit enabled through the whole server action.
  const [isFetching, startTransition] = useTransition()

  function handleDownload() {
    startTransition(async () => {
      // Fetches ALL matching transfers (unpaginated), same as Print/CSV exports —
      // the table data is paginated, so we can't use it directly.
      const result = await fetchFilteredTransfers(where)
      if (!result.success) {
        toast.error(result.error ?? 'Nie udało się pobrać danych', {
          position: 'bottom-center',
          theme: 'dark',
        })
        return
      }

      const date = new Date().toISOString().slice(0, 10)
      download(result.data, buildInvoiceArchiveName([], date))
    })
  }

  const isPending = isFetching || isZipping

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isPending}
      aria-label="Pobierz faktury"
    >
      {isPending ? <Loader2 className="animate-spin" /> : <FileArchive />}
      Faktury
    </Button>
  )
}
