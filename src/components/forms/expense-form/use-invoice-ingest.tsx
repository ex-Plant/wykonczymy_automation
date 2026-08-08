'use client'

import { useState } from 'react'
import { useInvoiceFiles, type IngestResultT } from '@/components/forms/hooks/use-invoice-files'
import { filesByRowId } from '@/lib/utils/upload-file-client'
import { MAX_UPLOAD_BYTES, type BlockedFileError } from '@/lib/utils/process-upload-file'
import { toastMessage } from '@/lib/utils/toast'

const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024)

// One Polish line per blocked file (unconvertible HEIC / oversize) in a single toast so one bad
// file in a batch never spams N toasts. Rendered as JSX rather than a "\n"-joined string because
// react-toastify collapses newlines in HTML — a multi-file block would otherwise run together. The
// MB figure tracks MAX_UPLOAD_BYTES (the guard), not the raw 4.5 MB Vercel cap.
function blockedFilesMessage(blocked: BlockedFileError[]) {
  return (
    <div>
      {blocked.map((error, index) => (
        <p key={index}>
          {error.reason === 'too-large'
            ? `Plik „${error.filename}” przekracza ${MAX_UPLOAD_MB} MB — zmniejsz go i spróbuj ponownie.`
            : `Nie udało się przekonwertować „${error.filename}” — zapisz jako JPG i spróbuj ponownie.`}
        </p>
      ))}
    </div>
  )
}

type ArgsT = {
  // The previous submit's positional Map<number,File> (wire order), if this mount is a recovery.
  recoveredFiles?: Map<number, File>
  // The recovered rows, in the same order — the id-space the positional files re-key onto.
  storedLineItems?: { id: string }[]
}

/**
 * The receipt-ingest half of the wydatek form: file custody (via useInvoiceFiles) plus the busy
 * state and user-facing messaging that ingest needs to be usable. Split out of expense-form.tsx
 * (EX-645) — the form component owns the form, this owns the pipeline a picked file travels
 * through before it is allowed to become a line item's invoice.
 *
 * `ingestingIds` is what the form does NOT get to ignore: a row still converting has no stored File
 * yet, so submitting mid-ingest would save the line item without its receipt. The form disables
 * submit on `isIngesting` and re-checks it in onSubmit, because a keyboard Enter bypasses the
 * button.
 */
export function useInvoiceIngest({ recoveredFiles, storedLineItems }: ArgsT) {
  // Rows whose picked file is still being processed at ingest (HEIC convert can take ~1-2 s). The
  // row shows a spinner and its actions are disabled meanwhile, and a batch scan waits for ingest
  // before running the AI generation. Keyed on each row's stable id (EX-448).
  const [ingestingIds, setIngestingIds] = useState<Set<string>>(new Set())

  // recoveredFiles is positional (wire order). Re-key it to id-space against the recovered rows
  // (same order) so the restored form stays id-keyed — ids survive the submit→fail→restore
  // round-trip via the stored form values.
  const recoveredFilesById =
    recoveredFiles && storedLineItems ? filesByRowId(storedLineItems, recoveredFiles) : undefined

  const { handleFileChange, registerFilesAt, ...files } = useInvoiceFiles(recoveredFilesById)

  function markIngesting(ids: string[], busy: boolean) {
    setIngestingIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (busy ? next.add(id) : next.delete(id)))
      return next
    })
  }

  function reportBlocked(blocked: BlockedFileError[]) {
    if (blocked.length === 0) return
    // TODO(EX-449) SENTRY-REQUIRED: blocked-file ingest failures (unconvertible HEIC / oversize)
    // must be captured once Sentry is wired — currently surfaced only as a per-item user toast.
    toastMessage(blockedFilesMessage(blocked), 'error', 8000)
  }

  // Run one ingest batch: mark the rows busy, report any blocked files, and — crucially — always
  // clear the spinner in `finally`. The finally is load-bearing: an unexpected ingest rejection
  // (e.g. a chunk-load failure on the lazy import) must still release the rows, or they stay busy
  // forever and wedge the whole form. Blocked files enter no map; the row stays empty. The reactive
  // file store re-renders attached rows (input → thumbnail) on its own — no remount key.
  async function runIngest(ids: string[], ingest: () => Promise<IngestResultT>) {
    markIngesting(ids, true)
    try {
      reportBlocked((await ingest()).blocked)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
    } finally {
      markIngesting(ids, false)
    }
  }

  return {
    ...files,
    ingestingIds,
    isIngesting: ingestingIds.size > 0,
    registerFiles: (ids: string[], picked: File[]) =>
      runIngest(ids, () => registerFilesAt(ids, picked)),
    attachFile: (id: string, e: React.ChangeEvent<HTMLInputElement>) =>
      runIngest([id], () => handleFileChange(id, e)),
  }
}
