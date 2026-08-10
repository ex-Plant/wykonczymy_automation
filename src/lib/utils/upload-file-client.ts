import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { postFormData } from '@/lib/utils/post-form-data'

// Cap parallel uploads to match the receipt-generation path (GENERATION_CONCURRENCY): batch-add lets a user
// attach 10-20+ receipts, and submitting them all at once would fire that many simultaneous upload requests.
const UPLOAD_CONCURRENCY = 4

/**
 * Thrown when any page of a submit fails to upload. Carries the ids that DID land, because those
 * files are already in Blob with nothing referencing them — the caller has to hand them to the
 * orphan cleanup or they leak. Multi-page submits made this the common failure, not the rare one.
 */
export class InvoiceUploadError extends Error {
  constructor(
    message: string,
    readonly uploadedIds: number[],
  ) {
    super(message)
    this.name = 'InvoiceUploadError'
  }
}

export async function uploadFileClient(file: File): Promise<number> {
  const formData = new FormData()
  formData.set('file', file)

  const { mediaId } = await postFormData<{ mediaId: number }>(
    '/api/upload-file',
    formData,
    'Upload nie powiódł się',
  )
  return mediaId
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
 *
 * A failure throws `InvoiceUploadError` carrying whatever already landed. Failures are caught per
 * page rather than propagated out of `mapWithConcurrency`, because that call rejects on the first
 * one while its other workers keep going — the ids they produce afterwards would be unrecoverable.
 */
export async function resolveInvoiceMediaIds(
  count: number,
  files: Map<number, File[]>,
  upload: (file: File) => Promise<number> = uploadFileClient,
): Promise<number[][]> {
  const pages = Array.from({ length: count }, (_, row) =>
    (files.get(row) ?? []).map((file) => ({ row, file })),
  ).flat()

  let failure: string | undefined
  const mediaIds = await mapWithConcurrency(pages, UPLOAD_CONCURRENCY, async ({ file }) => {
    // Once one page is lost the submit is doomed, so don't spend the user's bandwidth (and Blob
    // storage) uploading the rest of a 20-page batch just to delete it again.
    if (failure) return undefined
    try {
      return await upload(file)
    } catch (err) {
      failure ??= err instanceof Error ? err.message : 'Nie udało się przesłać plików'
      return undefined
    }
  })

  if (failure) {
    throw new InvoiceUploadError(
      failure,
      mediaIds.filter((id): id is number => id !== undefined),
    )
  }

  const byRow: number[][] = Array.from({ length: count }, () => [])
  pages.forEach(({ row }, offset) => {
    const mediaId = mediaIds[offset]
    if (mediaId !== undefined) byRow[row].push(mediaId)
  })
  return byRow
}
