'use client'

import { useState } from 'react'

import { reportBlockedFiles } from '@/lib/invoices/blocked-files-message'
import { ingestPickedFiles } from '@/lib/invoices/ingest-picked-files'
import { toastMessage } from '@/lib/utils/toast'

/**
 * File custody for the pick surfaces that carry one invoice's pages OUTSIDE the form value: the
 * przegląd form and the transfer-edit dialog. Files stay out of the value because they are
 * unserialisable — a persisted draft would either drop them silently or refuse to rehydrate.
 *
 * What is held here is already ingested — HEIC decoded, compressed, oversize rejected — so the
 * submit path only ever uploads files Blob will accept. `isIngesting` is what a caller does NOT get
 * to ignore: a file still converting is not in `files` yet, so submitting mid-ingest would save the
 * row without its attachment. Disable submit on it AND re-check it in the action, because a keyboard
 * Enter bypasses the button.
 */
export function useFilePickIngest() {
  const [files, setFiles] = useState<File[]>([])
  const [isIngesting, setIsIngesting] = useState(false)

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the form, or submit stays disabled until a reload.
  async function ingestPicked(picked: File[]) {
    setIsIngesting(true)
    try {
      const { files: ingested, blocked } = await ingestPickedFiles(picked)
      reportBlockedFiles(blocked)
      setFiles(ingested)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
      setFiles([])
    } finally {
      setIsIngesting(false)
    }
  }

  function reset() {
    setFiles([])
  }

  return { files, isIngesting, ingestPicked, reset }
}
