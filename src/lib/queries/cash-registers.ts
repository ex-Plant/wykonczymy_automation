import type { Payload } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

export async function findCashRegisters(payload: Payload, { page, limit }: PaginationParamsT) {
  const result = await payload.find({
    collection: 'cash-registers',
    sort: 'name',
    limit,
    page,
    depth: 1,
  })

  const rows: CashRegisterRowT[] = result.docs.map((cr) => ({
    id: cr.id,
    name: cr.name,
    ownerName: typeof cr.owner === 'object' && cr.owner !== null ? cr.owner.name : '—',
    balance: cr.balance ?? 0,
  }))

  return {
    rows,
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function getCashRegister(payload: Payload, id: string) {
  try {
    const register = await payload.findByID({ collection: 'cash-registers', id, depth: 1 })
    return register ?? undefined
  } catch {
    return undefined
  }
}

export async function findAllCashRegisters(payload: Payload) {
  const result = await payload.find({
    collection: 'cash-registers',
    pagination: false,
    depth: 0,
  })
  return result.docs
}
