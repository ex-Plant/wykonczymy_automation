import type { Payload } from 'payload'
import { buildPaginationMeta, type PaginationParamsT } from '@/lib/pagination'
import type { InvestmentRowT } from '@/lib/tables/investments'

export async function findInvestments(payload: Payload, { page, limit }: PaginationParamsT) {
  const result = await payload.find({
    collection: 'investments',
    sort: 'name',
    limit,
    page,
  })

  const rows: InvestmentRowT[] = result.docs.map((inv) => ({
    id: inv.id,
    name: inv.name,
    status: inv.status as 'active' | 'completed',
    totalCosts: inv.totalCosts ?? 0,
    address: inv.address ?? '',
    phone: inv.phone ?? '',
    email: inv.email ?? '',
    contactPerson: inv.contactPerson ?? '',
  }))

  return {
    rows,
    paginationMeta: buildPaginationMeta(result, limit),
  }
}

export async function getInvestment(payload: Payload, id: string) {
  try {
    const investment = await payload.findByID({ collection: 'investments', id })
    return investment ?? undefined
  } catch {
    return undefined
  }
}

export async function findActiveInvestments(payload: Payload) {
  const result = await payload.find({
    collection: 'investments',
    where: { status: { equals: 'active' } },
    pagination: false,
    depth: 0,
  })
  return result.docs
}
