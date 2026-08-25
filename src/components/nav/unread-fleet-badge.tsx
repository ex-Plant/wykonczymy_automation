'use client'

import { getUnreadFleetCount } from '@/lib/actions/notifications'
import { UnreadStreamBadge } from '@/components/nav/unread-stream-badge'

/** Deadlines that became urgent since the last visit. */
export function UnreadFleetBadge() {
  return <UnreadStreamBadge path="/flota" fetchCount={getUnreadFleetCount} />
}
