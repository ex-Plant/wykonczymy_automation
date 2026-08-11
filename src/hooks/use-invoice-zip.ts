'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'react-toastify'
import { triggerDownload } from '@/lib/export/download'
import { buildInvoiceZipMessage, buildUniqueFilename } from '@/lib/export/invoice-zip'
import { toastMessage } from '@/lib/utils/toast'

/**
 * The widest shape the zip loop needs — satisfied by both `TransferRowT` and
 * `MaterialTransactionRowT`. `description` is nullable because the materiały rows allow it; it only
 * ever feeds the generated filename, so an empty one degrades to a date-only name.
 */
export type InvoiceZipRowT = {
  date: string
  description: string | null
  invoiceUrl: string | null
  invoiceFilename: string | null
}

// Browsers cap concurrent connections per origin; larger batches just queue and stall the progress toast.
const BATCH_SIZE = 6

/**
 * Everything that happens *after* the rows are known: fetch each invoice blob, name it uniquely, zip,
 * hand the archive to the browser, and drive one in-place toast throughout.
 *
 * Split out of `InvoiceDownloadButton` because obtaining the rows and packing them are separate
 * concerns with separate auth needs — the transfers toolbar fetches its rows through an authenticated
 * server action, while the kosztorys Wydatki list already has them in props and runs on the
 * unauthenticated share path. Media is publicly readable, so packing needs no session either way.
 */
export function useInvoiceZip() {
  const [isPending, startTransition] = useTransition()
  const toastIdRef = useRef<string | number | null>(null)

  function download(rows: InvoiceZipRowT[], archiveName: string) {
    startTransition(async () => {
      toastIdRef.current = toast.info('Pobieranie faktur...', {
        autoClose: false,
        position: 'bottom-center',
        theme: 'dark',
      })

      try {
        const withInvoice = rows.filter((row) => row.invoiceUrl)
        if (withInvoice.length === 0) {
          updateToast(
            toastIdRef.current,
            buildInvoiceZipMessage({ total: rows.length, withInvoice: 0, downloaded: 0 }),
            'info',
          )
          return
        }

        updateToast(
          toastIdRef.current,
          `Pobieranie 0/${withInvoice.length} faktur...`,
          'info',
          false,
        )

        // Deferred so a client who never clicks doesn't pay for the ZIP machinery — this hook is
        // mounted on the public share page.
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        const usedNames = new Set<string>()
        let downloaded = 0

        for (let i = 0; i < withInvoice.length; i += BATCH_SIZE) {
          const batch = withInvoice.slice(i, i + BATCH_SIZE)
          await Promise.all(
            batch.map(async (row) => {
              try {
                const response = await fetch(row.invoiceUrl!)
                if (!response.ok) return

                const blob = await response.blob()
                const name = buildUniqueFilename(
                  row.date,
                  row.description ?? '',
                  row.invoiceFilename,
                  usedNames,
                )
                zip.file(name, blob)
                downloaded++
                updateToast(
                  toastIdRef.current,
                  `Pobieranie ${downloaded}/${withInvoice.length} faktur...`,
                  'info',
                  false,
                )
              } catch {
                // skip files that fail to download
              }
            }),
          )
        }

        const message = buildInvoiceZipMessage({
          total: rows.length,
          withInvoice: withInvoice.length,
          downloaded,
        })

        if (downloaded === 0) {
          updateToast(toastIdRef.current, message, 'error')
          return
        }

        updateToast(toastIdRef.current, 'Tworzenie archiwum ZIP...', 'info', false)
        triggerDownload(await zip.generateAsync({ type: 'blob' }), archiveName)
        updateToast(toastIdRef.current, message, 'success')
      } catch {
        updateToast(toastIdRef.current, 'Wystąpił nieoczekiwany błąd', 'error')
      }
    })
  }

  return { download, isPending }
}

function updateToast(
  id: string | number | null,
  message: string,
  type: 'info' | 'success' | 'error',
  autoClose: number | false = 2000,
) {
  if (id === null) {
    toastMessage(message, type)
    return
  }
  toast.update(id, { render: message, type, autoClose, theme: 'dark' })
}
