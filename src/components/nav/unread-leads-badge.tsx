'use client'

import { getUnreadLeadsCount } from '@/lib/actions/notifications'
import { UnreadStreamBadge } from '@/components/nav/unread-stream-badge'

export function UnreadLeadsBadge() {
  return <UnreadStreamBadge path="/zgloszenia" fetchCount={getUnreadLeadsCount} />
}
