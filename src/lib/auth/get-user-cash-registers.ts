import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/lib/auth/roles'
import { CACHE_TAGS } from '@/lib/cache/tags'

/**
 * Returns the cash register ids owned by the given user if they are a MANAGER.
 * Returns `undefined` for ADMIN/OWNER (meaning "no restriction — all registers").
 */
export async function getUserCashRegisterIds(
  userId: number,
  role: RoleT,
): Promise<number[] | undefined> {
  if (role !== 'MANAGER') return undefined
  return getCachedManagerRegisterIds(userId)
}

async function getCachedManagerRegisterIds(userId: number) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.cashRegisters)

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'cash-registers',
    where: { owner: { equals: userId } },
    limit: 100,
    depth: 0,
  })
  return docs.map((doc) => doc.id as number)
}
