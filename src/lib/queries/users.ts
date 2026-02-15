import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Payload } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { sumAllWorkerSaldos, sumEmployeeSaldo } from '@/lib/db/sum-transactions'
import type { UserRowT } from '@/lib/tables/users'
import type { RoleT } from '@/lib/auth/roles'
import { CACHE_TAGS } from '@/lib/cache/tags'

export async function findUsersWithSaldos(payload: Payload, { page, limit }: PaginationParamsT) {
  const getCachedSaldos = unstable_cache(
    async () => {
      const pl = await getPayload({ config })
      const map = await sumAllWorkerSaldos(pl)
      return Object.fromEntries(map)
    },
    ['all-worker-saldos'],
    { tags: [CACHE_TAGS.transactions] },
  )

  const [users, saldoRecord] = await Promise.all([
    payload.find({ collection: 'users', sort: 'name', limit, page }),
    getCachedSaldos(),
  ])

  const saldoMap = new Map(Object.entries(saldoRecord).map(([k, v]) => [Number(k), v]))

  const rows: UserRowT[] = users.docs.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as RoleT,
    saldo: saldoMap.get(u.id) ?? 0,
  }))

  return {
    rows,
    paginationMeta: buildPaginationMeta(users, limit),
  }
}

export async function getUser(payload: Payload, id: string) {
  try {
    const user = await payload.findByID({ collection: 'users', id })
    return user ?? undefined
  } catch {
    return undefined
  }
}

export async function getUserSaldo(userId: string) {
  const getCachedSaldo = unstable_cache(
    async (workerId: number) => {
      const pl = await getPayload({ config })
      return sumEmployeeSaldo(pl, workerId)
    },
    ['employee-saldo', userId],
    { tags: [CACHE_TAGS.transactions] },
  )

  return getCachedSaldo(Number(userId))
}
