import type { CollectionAfterDeleteHook } from 'payload'
import { invoiceIds } from '@/lib/queries/transfer-mapping'
import { logError } from '@/lib/utils/log-error'

/**
 * Deleting an expense unreachable-izes its invoice pages: a media row is only ever linked from the
 * transfer that uploaded it, so once that transfer is gone nothing can reach the file again — it
 * just keeps costing Blob storage. A hook rather than a server action because expense deletion has
 * no action path: it happens in the Payload admin panel, which reaches the collection directly.
 *
 * Best-effort and logged, mirroring the orphan cleanup in `setTransferInvoices`: a failed media
 * delete must not fail the expense delete that already committed.
 */
export const deleteInvoiceMediaAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  for (const mediaId of invoiceIds(doc.invoice)) {
    await req.payload
      .delete({ collection: 'media', id: mediaId, req })
      .catch((err) => logError('[transfers] delete invoice media after expense delete failed', err))
  }

  return doc
}
