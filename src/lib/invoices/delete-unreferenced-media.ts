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
 * **One id at a time, never `Promise.all`.** On the deployed database (Neon through
 * `@payloadcms/db-vercel-postgres`) concurrent Payload writes share a session: every `delete`
 * resolves as if it succeeded, and only one of them is actually committed. Deleting the pages of a
 * multi-page invoice in parallel therefore left every page but one in storage with nothing pointing
 * at it — silently, because none of the calls reported an error. Reproduced against that database;
 * a local single-connection Postgres never showed it. The reads are serialized for the same reason:
 * a count that comes back wrong is a page leaked, not a page deleted twice.
 *
 * Best-effort per id: this always runs after the write it cleans up for, so a failed delete must
 * leak a file rather than fail the mutation the user actually asked for.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  for (const id of mediaIds) {
    try {
      const inTransfers = await payload.count({
        collection: 'transactions',
        where: { invoice: { equals: id } },
      })
      const inInspections = await payload.count({
        collection: 'vehicle-inspections',
        where: { attachments: { equals: id } },
      })
      if (inTransfers.totalDocs > 0 || inInspections.totalDocs > 0) continue

      await payload.delete({ collection: 'media', id })
    } catch (err) {
      logError('[invoices] delete unreferenced media failed', err)
    }
  }
}
