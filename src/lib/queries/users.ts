import { cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import { sumAllWorkerSaldos, sumEmployeeSaldo } from '@/lib/db/sum-transactions'
import type { UserRowT } from '@/lib/tables/users'
import type { RoleT } from '@/lib/auth/roles'
import { CACHE_TAGS } from '@/lib/cache/tags'

export async function findUsersWithSaldos({ page, limit }: PaginationParamsT) {
  'use cache'
  cacheTag(CACHE_TAGS.transactions, CACHE_TAGS.users)

  const payload = await getPayload({ config })
  const [users, saldoRecord] = await Promise.all([
    payload.find({ collection: 'users', sort: 'name', limit, page }),
    sumAllWorkerSaldos(payload).then((map) => Object.fromEntries(map)),
  ])

  const rows: UserRowT[] = users.docs.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as RoleT,
    saldo: saldoRecord[String(u.id)] ?? 0,
  }))

  return {
    rows,
    paginationMeta: buildPaginationMeta(users, limit),
  }
}

export async function getUser(id: string) {
  'use cache'
  cacheTag(CACHE_TAGS.users)

  const payload = await getPayload({ config })
  try {
    const user = await payload.findByID({ collection: 'users', id })
    return user ?? null
  } catch {
    return null
  }
}

export async function getUserSaldo(userId: string) {
  'use cache'
  cacheTag(CACHE_TAGS.transactions)

  const payload = await getPayload({ config })
  return sumEmployeeSaldo(payload, Number(userId))
}

export async function findAllUsers() {
  'use cache'
  cacheTag(CACHE_TAGS.users)

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'users',
    limit: 100,
    depth: 0,
  })
  return result.docs.map((u) => ({
    id: u.id as number,
    name: u.name as string,
  }))
}
