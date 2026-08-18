'use server'

import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { countUnreadFleetDeadlines, countUnreadLeads } from '@/lib/db/notifications'

/**
 * Unread new-lead count for the nav badge. Wraps protectedAction (auth + payload +
 * perf + error handling); the badge treats any non-success as 0, so a failure just
 * hides the badge rather than breaking the nav. Fetched client-side on navigation.
 */
export async function getUnreadLeadsCount(): Promise<ActionResultT<number>> {
  return protectedAction('getUnreadLeadsCount', async ({ payload, user }) => ({
    success: true,
    data: await countUnreadLeads(payload, user.id),
  }))
}

/** Same posture as above, for the Flota nav badge. */
export async function getUnreadFleetCount(): Promise<ActionResultT<number>> {
  return protectedAction('getUnreadFleetCount', async ({ payload, user }) => ({
    success: true,
    data: await countUnreadFleetDeadlines(payload, user.id),
  }))
}
