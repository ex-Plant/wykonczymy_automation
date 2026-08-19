'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isManagementRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { CountBadge } from '@/components/ui/count-badge'
import type { ActionResultT } from '@/types/action'

type UnreadStreamBadgePropsT = {
  /** The section this badge counts for; visiting it is what marks the stream seen. */
  path: string
  fetchCount: () => Promise<ActionResultT<number>>
}

/**
 * Unread-count bubble on a nav item. Refetches on every navigation (keyed on pathname) — no polling,
 * no socket; new items surface the next time the user clicks around, which is fine for non-critical
 * data. On the section's own page the count is 0 by definition (the server render advances the read
 * cursor), so we short-circuit the fetch to avoid a stale-count race with that write.
 *
 * Self-gates on role: only management fetches or renders, so the badge can be wired unconditionally
 * into the nav (via the SECTION_LINKS `badge` field) without leaking a wasted server-action call for
 * non-management users.
 *
 * Effect is the sanctioned use here: syncing local state to an external source (the router location)
 * is exactly what useEffect is for.
 */
export function UnreadStreamBadge({ path, fetchCount }: UnreadStreamBadgePropsT) {
  const user = useCurrentUser()
  const pathname = usePathname()
  const [fetchedCount, setFetchedCount] = useState(0)

  const isManager = isManagementRole(user.role)
  const onSectionPage = pathname.startsWith(path)

  useEffect(() => {
    if (!isManager || onSectionPage) return
    fetchCount().then((result) => setFetchedCount(result.success ? result.data : 0))
  }, [pathname, onSectionPage, isManager, fetchCount])

  if (!isManager) return null

  // Derived, not stored, so the effect never calls setState synchronously.
  return <CountBadge count={onSectionPage ? 0 : fetchedCount} />
}
