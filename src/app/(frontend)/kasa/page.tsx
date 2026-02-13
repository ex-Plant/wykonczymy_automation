import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { CashRegisterDataTable } from './_components/cash-register-data-table'
import type { CashRegisterRowT } from '@/lib/cash-registers/types'
import { PageWrapper } from '@/components/ui/page-wrapper'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CashRegistersPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const params = await searchParams

  // Pagination
  const pageParam = typeof params.page === 'string' ? Number(params.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1

  const limitParam = typeof params.limit === 'string' ? Number(params.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const payload = await getPayload({ config })

  const cashRegisters = await payload.find({
    collection: 'cash-registers',
    sort: 'name',
    limit,
    page: currentPage,
    depth: 1,
  })

  const rows: CashRegisterRowT[] = cashRegisters.docs.map((cr) => ({
    id: cr.id,
    name: cr.name,
    ownerName: typeof cr.owner === 'object' && cr.owner !== null ? cr.owner.name : '—',
    balance: cr.balance ?? 0,
  }))

  const paginationMeta = {
    currentPage: cashRegisters.page ?? 1,
    totalPages: cashRegisters.totalPages,
    totalDocs: cashRegisters.totalDocs,
    limit,
  }

  return (
    <PageWrapper title="Kasy">
      <div className="mt-6">
        <CashRegisterDataTable data={rows} paginationMeta={paginationMeta} />
      </div>
    </PageWrapper>
  )
}
