import 'server-only'

import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'

/**
 * Page-level management guard: require a management session or bounce to the login page.
 *
 * Redirecting is the whole contract. A page that instead lets a DAL guard's `throw` decide the
 * outcome shows an error screen to someone who is merely logged out — and mixing the two modes in
 * one `Promise.all` makes which one wins a race. Pages that also need the investment loaded use
 * `requireInvestmentOr404`; this is for the ones that already hold it.
 */
export async function requireManagementPage(): Promise<SessionUserT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  return session.user
}
