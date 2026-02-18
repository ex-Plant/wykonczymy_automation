import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'

type RefItemT = { readonly id: number; readonly name: string }

export type ReferenceDataT = {
  readonly cashRegisters: RefItemT[]
  readonly investments: RefItemT[]
  readonly workers: RefItemT[]
  readonly otherCategories: RefItemT[]
}

export async function fetchReferenceData(): Promise<ReferenceDataT> {
  'use cache'
  cacheLife('max')
  cacheTag(
    CACHE_TAGS.cashRegisters,
    CACHE_TAGS.investments,
    CACHE_TAGS.users,
    CACHE_TAGS.otherCategories,
  )

  const start = performance.now()
  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT 'cashRegisters' AS collection, id, name FROM cash_registers
    UNION ALL
    SELECT 'investments' AS collection, id, name FROM investments WHERE status = 'active'
    UNION ALL
    SELECT 'workers' AS collection, id, name FROM users
    UNION ALL
    SELECT 'otherCategories' AS collection, id, name FROM other_categories
  `)
  console.log(
    `[PERF] query.fetchReferenceData ${(performance.now() - start).toFixed(1)}ms (1 SQL, ${result.rows.length} rows)`,
  )

  const data: Record<string, RefItemT[]> = {
    cashRegisters: [],
    investments: [],
    workers: [],
    otherCategories: [],
  }

  for (const row of result.rows) {
    data[row.collection as string]?.push({
      id: Number(row.id),
      name: row.name as string,
    })
  }

  return data as ReferenceDataT
}
