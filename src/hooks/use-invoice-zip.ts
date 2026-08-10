'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'react-toastify'
import { triggerDownload } from '@/lib/export/download'
import {
  buildInvoiceZipMessage,
  flattenInvoiceRows,
  type InvoiceZipFileT,
  type InvoiceZipRowT,
} from '@/lib/export/invoice-zip'
import { toastMessage } from '@/lib/utils/toast'

export type { InvoiceZipRowT }

// Browsers cap concurrent connections per origin; larger batches just queue and stall the progress toast.
const BATCH_SIZE = 6

/**
 * Everything that happens *after* the rows are known: fetch each invoice page, name it uniquely, zip,
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

  function run(job: () => Promise<void>) {
    startTransition(async () => {
      toastIdRef.current = toast.info('Pobieranie faktur...', {
        autoClose: false,
        position: 'bottom-center',
        theme: 'dark',
      })

      try {
        await job()
      } catch {
        updateToast(toastIdRef.current, 'Wystąpił nieoczekiwany błąd', 'error')
      }
    })
  }

  /** Archives every page of every row, and reports the row/page tally the toast needs. */
  function download(rows: InvoiceZipRowT[], archiveName: string) {
    run(async () => {
      const rowsWithInvoice = rows.filter((row) => row.invoices.length > 0).length
      const files = flattenInvoiceRows(rows)
      const tally = {
        rows: rows.length,
        rowsWithInvoice,
        expectedFiles: files.length,
        downloadedFiles: 0,
      }

      if (files.length === 0) {
        updateToast(toastIdRef.current, buildInvoiceZipMessage(tally), 'info')
        return
      }

      tally.downloadedFiles = await packAndDeliver(files, archiveName)
      const message = buildInvoiceZipMessage(tally)
      updateToast(toastIdRef.current, message, tally.downloadedFiles === 0 ? 'error' : 'success')
    })
  }

  /** Archives one expense's pages, where there is no row tally to report — only the pages. */
  function downloadFiles(files: InvoiceZipFileT[], archiveName: string) {
    run(async () => {
      const downloadedFiles = await packAndDeliver(files, archiveName)
      const message = buildInvoiceZipMessage({
        rows: 1,
        rowsWithInvoice: files.length > 0 ? 1 : 0,
        expectedFiles: files.length,
        downloadedFiles,
      })
      updateToast(toastIdRef.current, message, downloadedFiles === 0 ? 'error' : 'success')
    })
  }

  /** Fetches the pages in bounded batches, zips what arrived, and hands it to the browser. */
  async function packAndDeliver(files: InvoiceZipFileT[], archiveName: string): Promise<number> {
    updateToast(toastIdRef.current, `Pobieranie 0/${files.length} plików...`, 'info', false)

    // Deferred so a client who never clicks doesn't pay for the ZIP machinery — this hook is
    // mounted on the public share page.
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    let downloaded = 0

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      await Promise.all(
        files.slice(i, i + BATCH_SIZE).map(async (file) => {
          try {
            const response = await fetch(file.url)
            if (!response.ok) return

            zip.file(file.name, await response.blob())
            downloaded++
            updateToast(
              toastIdRef.current,
              `Pobieranie ${downloaded}/${files.length} plików...`,
              'info',
              false,
            )
          } catch {
            // skip files that fail to download
          }
        }),
      )
    }

    if (downloaded === 0) return 0

    updateToast(toastIdRef.current, 'Tworzenie archiwum ZIP...', 'info', false)
    triggerDownload(await zip.generateAsync({ type: 'blob' }), archiveName)
    return downloaded
  }

  return { download, downloadFiles, isPending }
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
