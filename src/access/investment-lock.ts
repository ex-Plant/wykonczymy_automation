import type { Access } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { getDb } from '@/lib/db/get-db'
import { isInvestmentLocked } from '@/lib/db/investment-lock'

/**
 * Closes `/admin` as a way around the lock. The app's own writes are gated in the action layer
 * (`investmentAction`), which the panel never goes through — a MANAGER reaches `/admin` and every
 * kosztorys collection grants it the full CRUD, so without this the panel edits a settled
 * investment's rozpiska freely.
 *
 * `read` deliberately stays open: a locked kosztorys is read-only, not hidden.
 */

// The path from the collection's own row to `investments.status`. `stage-progress` carries no
// investment of its own, so it reaches the status through its pozycja.
type LockPathT = 'investment.status' | 'item.investment.status'

// The relationship on the incoming `data` that names the target investment for a create.
type CreateOwnerT = { field: 'investment' } | { field: 'item'; via: 'kosztorys-items' }

const relationId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value)
    return Number((value as { id: unknown }).id)
  return undefined
}

export function unlessInvestmentLocked(path: LockPathT): Access {
  return (args) => {
    const allowed = isAdminOrOwnerOrManager(args)
    if (allowed !== true) return allowed
    return { [path]: { not_equals: 'completed' } }
  }
}

export function createUnlessInvestmentLocked(owner: CreateOwnerT): Access {
  return async (args) => {
    const allowed = isAdminOrOwnerOrManager(args)
    if (allowed !== true) return allowed

    const data = args.data as Record<string, unknown> | undefined
    const ownerId = relationId(data?.[owner.field])
    // No owner in the payload means the create fails validation anyway (both relationships are
    // required) — refusing here would just replace that message with a misleading one.
    if (ownerId === undefined) return true

    const payload = args.req.payload
    const db = await getDb(payload, args.req)
    if ('via' in owner) {
      const item = await payload.findByID({
        collection: owner.via,
        id: ownerId,
        depth: 0,
        overrideAccess: true,
      })
      const investmentId = relationId(item?.investment)
      if (investmentId === undefined) return true
      return !(await isInvestmentLocked(db, investmentId))
    }
    return !(await isInvestmentLocked(db, ownerId))
  }
}
