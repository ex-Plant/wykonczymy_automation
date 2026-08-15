import 'server-only'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'

/**
 * Narrow an action to owner/admin, above `MANAGEMENT_ROLES`. Used by everything that decides what a
 * client is served — the share token and the client-view settings — because a role that cannot
 * revoke a link must not be able to hand one out, nor to change what it shows. Wrapping
 * `protectedAction` runs that narrowing structurally, so a new action cannot forget a hand-copied
 * `if`.
 */
export function ownerOnlyAction<TData = undefined>(
  label: string,
  forbiddenMessage: string,
  handler: (ctx: { payload: Payload; user: SessionUserT }) => Promise<ActionResultT<TData>>,
): Promise<ActionResultT<TData>> {
  return protectedAction<TData>(label, async (ctx) => {
    if (!isAdminOrOwnerRole(ctx.user.role)) {
      return { success: false, error: forbiddenMessage } as ActionResultT<TData>
    }
    return handler(ctx)
  })
}
