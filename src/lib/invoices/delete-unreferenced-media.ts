import type { Payload } from 'payload'
import { logError } from '@/lib/utils/log-error'

/**
 * Delete only the media rows nothing points at any more. Call it AFTER the write that dropped the
 * reference, so the count reflects the new state.
 *
 * The reference check is the whole point: the `_rels` FKs are ON DELETE cascade, so deleting a row
 * still attached elsewhere silently strips that page from whatever else holds it. Nothing enforces
 * "a media row is only ever linked from the upload that created it" — the admin panel's picker can
 * attach one file twice, and a client-side cleanup can fire while the write it thought failed
 * actually committed. Both collections that relate to `media` are checked; a third one added later
 * must be added here too, or it loses its files to this function.
 *
 * Best-effort per id: this always runs after the write it cleans up for, so a failed delete must
 * leak a file rather than fail the mutation the user actually asked for.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  await Promise.all(
    mediaIds.map(async (id) => {
      try {
        const references = await Promise.all([
          payload.count({ collection: 'transactions', where: { invoice: { equals: id } } }),
          payload.count({
            collection: 'vehicle-inspections',
            where: { attachments: { equals: id } },
          }),
        ])
        if (references.some(({ totalDocs }) => totalDocs > 0)) return
        await payload.delete({ collection: 'media', id })
      } catch (err) {
        logError('[invoices] delete unreferenced media failed', err)
      }
    }),
  )
}
