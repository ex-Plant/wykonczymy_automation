'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getUnreadFleetCount } from '@/lib/actions/notifications'
import { isManagementRole } from '@/lib/auth/roles'
import { useCurrentUser } from '@/hooks/use-current-user'
import { CountBadge } from '@/components/ui/count-badge'

const FLEET_PATH = '/flota'

/** Deadlines that became urgent since the last visit. Mirrors `unread-leads-badge.tsx`. */
export function UnreadFleetBadge() {
  const user = useCurrentUser()
  const pathname = usePathname()
  const [fetchedCount, setFetchedCount] = useState(0)

  const isManager = isManagementRole(user.role)
  const onFleetPage = pathname.startsWith(FLEET_PATH)

  useEffect(() => {
    if (!isManager || onFleetPage) return
    getUnreadFleetCount().then((result) => setFetchedCount(result.success ? result.data : 0))
  }, [pathname, onFleetPage, isManager])

  if (!isManager) return null

  const count = onFleetPage ? 0 : fetchedCount

  return <CountBadge count={count} />
}
