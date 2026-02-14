import 'server-only'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/collections/users'

/**
 * Returns the cash register ids owned by the given user if they are a MANAGER.
 * Returns `undefined` for ADMIN/OWNER (meaning "no restriction — all registers").
 */
export async function getUserCashRegisterIds(
  userId: number,
  role: RoleT,
): Promise<number[] | undefined> {
  if (role !== 'MANAGER') return undefined

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'cash-registers',
    where: { owner: { equals: userId } },
    limit: 100,
    depth: 0,
  })

  return docs.map((doc) => doc.id as number)
}
