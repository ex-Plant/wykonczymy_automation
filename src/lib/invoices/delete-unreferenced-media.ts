import type { Payload } from 'payload'
import { logError } from '@/lib/utils/log-error'

/**
 * Delete only the media rows nothing points at any more. Call it AFTER the write that dropped the
 * reference, so the count reflects the new state.
 *
 * The reference check is the whole point: `transactions_rels.media_id` is ON DELETE cascade, so
 * deleting a row still attached elsewhere silently strips that page from the other expense. Callers
 * used to assume "a media row is only ever linked from the transfer that uploaded it" — nothing
 * enforces that, and the admin panel's upload picker can attach one file to a second transaction.
 *
 * Best-effort per id: this always runs after the write it cleans up for, so a failed delete must
 * leak a file rather than fail the mutation the user actually asked for.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  await Promise.all(
    mediaIds.map(async (id) => {
      try {
        const { totalDocs } = await payload.count({
          collection: 'transactions',
          where: { invoice: { equals: id } },
        })
        if (totalDocs > 0) return
        await payload.delete({ collection: 'media', id })
      } catch (err) {
        logError('[invoices] delete unreferenced media failed', err)
      }
    }),
  )
}
