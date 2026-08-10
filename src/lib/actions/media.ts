'use server'

import { protectedAction } from './run-action'
import { logError } from '@/lib/utils/log-error'

/**
 * Delete media that ended up attached to nothing. The add form uploads every page before it creates
 * the expense, so a create that fails afterwards leaves those files in Blob with no row pointing at
 * them — unreachable and unbilled-for forever. Best-effort per id: one failed delete must not hide
 * the create error the user actually needs to see.
 */
export async function deleteOrphanedMediaAction(mediaIds: number[]) {
  return protectedAction(`deleteOrphanedMediaAction count=${mediaIds.length}`, async ({ payload }) => {
    for (const id of mediaIds) {
      await payload
        .delete({ collection: 'media', id })
        .catch((err) => logError('[media] delete orphaned upload failed', err))
    }
    return { success: true }
  })
}
