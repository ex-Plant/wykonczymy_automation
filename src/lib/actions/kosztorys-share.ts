'use server'

import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import type { ActionResultT } from '@/types/action'

// 24 bytes ≈ 192 bits of entropy — the token IS the credential for an unauthenticated page, so it
// has to be unguessable at the scale of the whole internet, not just of this company's users.
const TOKEN_BYTES = 24

// All three share actions are owner-only, not just MANAGEMENT_ROLES: the token is a bearer credential,
// so a role that cannot rotate or revoke a link must not be able to read one and hand it out either.
const FORBIDDEN = 'Tylko właściciel może udostępniać kosztorys inwestorowi'

async function findShare(payload: Payload, investmentId: number) {
  const shares = await payload.find({
    collection: 'kosztorys-shares',
    where: { investment: { equals: investmentId } },
    depth: 0,
    limit: 1,
  })
  return shares.docs[0] ?? null
}

export async function getShareLinkAction(
  investmentId: number,
): Promise<ActionResultT<string | null>> {
  return ownerOnlyAction<string | null>('getShareLinkAction', FORBIDDEN, async ({ payload }) => {
    const share = await findShare(payload, investmentId)
    return { success: true, data: share?.token ?? null }
  })
}

/**
 * Mint or rotate the link. Rotation is the same call over an existing row: the old token is
 * overwritten, which is what makes „wygeneruj nowy" an actual revocation of the previous URL rather
 * than a second live door into the same kosztorys.
 */
export async function generateShareLinkAction(
  investmentId: number,
): Promise<ActionResultT<string>> {
  return ownerOnlyAction<string>('generateShareLinkAction', FORBIDDEN, async ({ payload }) => {
    const token = randomBytes(TOKEN_BYTES).toString('base64url')
    const share = await findShare(payload, investmentId)
    if (share) {
      await payload.update({ collection: 'kosztorys-shares', id: share.id, data: { token } })
      return { success: true, data: token }
    }

    try {
      await payload.create({
        collection: 'kosztorys-shares',
        data: { investment: investmentId, token },
      })
    } catch {
      // find-then-create is not atomic, and `investment` is unique — two owners clicking at once
      // race here. The loser's create hits the constraint; re-read rather than surface a raw DB
      // error, since by then a link demonstrably exists and that is all the caller wanted.
      const existing = await findShare(payload, investmentId)
      if (!existing) return { success: false, error: 'Nie udało się wygenerować linku' }
      return { success: true, data: existing.token }
    }
    return { success: true, data: token }
  })
  // No revalidation: the token lookup is deliberately uncached, so no tag holds anything for a
  // share write to bust.
}

// No row, no public read — the token stops resolving on the next request.
export async function revokeShareLinkAction(investmentId: number): Promise<ActionResultT> {
  return ownerOnlyAction('revokeShareLinkAction', FORBIDDEN, async ({ payload }) => {
    const share = await findShare(payload, investmentId)
    if (share) await payload.delete({ collection: 'kosztorys-shares', id: share.id })
    return { success: true }
  })
}
