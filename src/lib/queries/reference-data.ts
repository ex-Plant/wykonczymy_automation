import { cacheLife, cacheTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/sum-transfers'

type RefItemT = { readonly id: number; readonly name: string }
type CashRegisterRefItemT = RefItemT & { readonly type: 'MAIN' | 'AUXILIARY' }

export type ReferenceDataT = {
  readonly cashRegisters: CashRegisterRefItemT[]
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
    SELECT 'cashRegisters' AS collection, id, name, type FROM cash_registers
    UNION ALL
    SELECT 'investments' AS collection, id, name, NULL AS type FROM investments WHERE status = 'active'
    UNION ALL
    SELECT 'workers' AS collection, id, name, NULL AS type FROM users
    UNION ALL
    SELECT 'otherCategories' AS collection, id, name, NULL AS type FROM other_categories
  `)
  console.log(
    `[PERF] query.fetchReferenceData ${(performance.now() - start).toFixed(1)}ms (1 SQL, ${result.rows.length} rows)`,
  )

  const cashRegisters: CashRegisterRefItemT[] = []
  const investments: RefItemT[] = []
  const workers: RefItemT[] = []
  const otherCategories: RefItemT[] = []

  for (const row of result.rows) {
    const collection = row.collection as string
    const item = { id: Number(row.id), name: row.name as string }

    if (collection === 'cashRegisters') {
      cashRegisters.push({
        ...item,
        type: (row.type as 'MAIN' | 'AUXILIARY') ?? 'AUXILIARY',
      })
    } else if (collection === 'investments') {
      investments.push(item)
    } else if (collection === 'workers') {
      workers.push(item)
    } else if (collection === 'otherCategories') {
      otherCategories.push(item)
    }
  }

  return { cashRegisters, investments, workers, otherCategories } as ReferenceDataT
}
