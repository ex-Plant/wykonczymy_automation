import { discardOrphanedUploads } from '@/lib/utils/discard-orphaned-uploads'
import { InvoiceUploadError, resolveInvoicePageIds } from '@/lib/utils/upload-file-client'
import type { ActionResultT } from '@/types/action'

/**
 * Upload one invoice's pages, then run the mutation that references them. Pages land in Blob BEFORE
 * the row exists, so every path where the mutation does not attach them has to hand them back — a
 * page nothing references is unreachable, and Blob has no undelete to find it with later.
 *
 * There are three such paths and they look nothing alike, which is why every caller that rolled
 * this by hand got at least one of them wrong: the upload itself fails partway (some pages already
 * landed), the mutation returns a failure, or the mutation *throws* — a dropped connection mid-save
 * or a deploy invalidating the server action id. The throw is re-thrown rather than folded into a
 * failure result so the caller's own error handling still sees it as one.
 */
export async function submitWithInvoicePages(
  files: File[],
  submit: (invoicePageIds: number[]) => Promise<ActionResultT>,
): Promise<ActionResultT> {
  if (files.length === 0) return submit([])

  let pageIds: number[]
  try {
    pageIds = await resolveInvoicePageIds(files)
  } catch (err) {
    if (err instanceof InvoiceUploadError) discardOrphanedUploads(err.uploadedIds)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Nie udało się przesłać plików',
    }
  }

  let result: ActionResultT
  try {
    result = await submit(pageIds)
  } catch (err) {
    discardOrphanedUploads(pageIds)
    throw err
  }
  if (!result.success) discardOrphanedUploads(pageIds)
  return result
}
