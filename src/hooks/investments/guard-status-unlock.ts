import type { CollectionBeforeChangeHook } from 'payload'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'

export const INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE =
  'Zakończoną inwestycję może odblokować tylko właściciel lub administrator.'

/**
 * The rule the whole lock rests on. Without it the lock is theatre: `updateInvestmentAction` runs
 * under MANAGEMENT_ROLES, so a MANAGER would flip a zakończona inwestycja back to „Aktywna", book
 * whatever they liked and flip it back. In the collection hook rather than the action because
 * `/admin` grants MANAGER `update` on investments — that would be the second way round.
 *
 * Only the EXIT is narrowed. Closing a settled job is a manager's work, so entering `completed`
 * stays open to every management role, and the eight kartoteka fields are untouched either way.
 */
export const guardInvestmentStatusUnlock: CollectionBeforeChangeHook = ({
  data,
  req,
  originalDoc,
}) => {
  const wasCompleted = (originalDoc as { status?: string } | undefined)?.status === 'completed'
  const nextStatus = (data as { status?: string }).status
  if (!wasCompleted || nextStatus === undefined || nextStatus === 'completed') return data

  const role = req.user?.role
  if (!role || !isAdminOrOwnerRole(role)) {
    throw new Error(INVESTMENT_UNLOCK_FORBIDDEN_MESSAGE)
  }
  return data
}
