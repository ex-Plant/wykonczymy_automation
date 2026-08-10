import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'

// Cap parallel uploads to match the receipt-generation path (GENERATION_CONCURRENCY): batch-add lets a user
// attach 10-20+ receipts, and submitting them all at once would fire that many simultaneous upload requests.
const UPLOAD_CONCURRENCY = 4

type UploadResultT = { mediaId: number }

/** Upload a file (already processed at ingest) via the API route. Returns the media ID. */
export async function uploadFileClient(file: File): Promise<number> {
  const formData = new FormData()
  formData.set('file', file)

  const res = await fetch('/api/upload-file', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload nie powiódł się' }))
    throw new Error(body.error ?? `Upload failed (${res.status})`)
  }

  const data: UploadResultT = await res.json()
  return data.mediaId
}

// Out-of-form invoice files are keyed by each row's stable client id (EX-448), but the submit
// contract (resolveInvoiceMediaIds / createBulkTransferAction) is positional AND nested: row i is
// `lineItems[i]`, and its invoice pages are `mediaIds[i][0..n]` in attachment order (EX-659). These
// two pure projections bridge id-space ↔ position-space at that seam and nowhere else, so the whole
// in-form apparatus stays id-keyed while the wire stays positional.

/** id-space → position-space: project the id-keyed page lists onto row positions for submit. */
export function positionalFiles(
  lineItems: { id: string }[],
  byId: Map<string, File[]>,
): Map<number, File[]> {
  const positional = new Map<number, File[]>()
  lineItems.forEach((item, index) => {
    const files = byId.get(item.id)
    if (files?.length) positional.set(index, files)
  })
  return positional
}

/**
 * position-space → id-space: re-key positionally-persisted page lists (a recovered optimistic
 * submission, still in wire order) onto the recovered rows' ids so the restored form is id-keyed.
 */
export function filesByRowId(
  lineItems: { id: string }[],
  positional: Map<number, File[]>,
): Map<string, File[]> {
  const byId = new Map<string, File[]>()
  lineItems.forEach((item, index) => {
    const files = positional.get(index)
    if (files?.length) byId.set(item.id, files)
  })
  return byId
}

/**
 * Positional invoice-mediaId lists for submit. Per row index: upload every attached page in order;
 * a row with no files gets an empty list. The concurrency cap bounds total files in flight rather
 * than rows — one row can now carry a whole multi-page invoice on its own. `upload` is injectable
 * for tests.
 */
export async function resolveInvoiceMediaIds(
  count: number,
  files: Map<number, File[]>,
  upload: (file: File) => Promise<number> = uploadFileClient,
): Promise<number[][]> {
  const pages = Array.from({ length: count }, (_, row) =>
    (files.get(row) ?? []).map((file) => ({ row, file })),
  ).flat()

  const mediaIds = await mapWithConcurrency(pages, UPLOAD_CONCURRENCY, ({ file }) => upload(file))

  const byRow: number[][] = Array.from({ length: count }, () => [])
  pages.forEach(({ row }, offset) => byRow[row].push(mediaIds[offset]))
  return byRow
}
