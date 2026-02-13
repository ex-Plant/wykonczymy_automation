import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { InvestmentDataTable } from './_components/investment-data-table'
import type { InvestmentRowT } from '@/lib/investments/types'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvestmentsPage({ searchParams }: PagePropsT) {
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

  const investments = await payload.find({
    collection: 'investments',
    sort: 'name',
    limit,
    page: currentPage,
  })

  const rows: InvestmentRowT[] = investments.docs.map((inv) => ({
    id: inv.id,
    name: inv.name,
    status: inv.status as 'active' | 'completed',
    totalCosts: inv.totalCosts ?? 0,
    address: inv.address ?? '',
    phone: inv.phone ?? '',
    email: inv.email ?? '',
    contactPerson: inv.contactPerson ?? '',
  }))

  const paginationMeta = {
    currentPage: investments.page ?? 1,
    totalPages: investments.totalPages,
    totalDocs: investments.totalDocs,
    limit,
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-foreground text-2xl font-semibold">Inwestycje</h1>

      <div className="mt-6">
        <InvestmentDataTable data={rows} paginationMeta={paginationMeta} />
      </div>
    </div>
  )
}
