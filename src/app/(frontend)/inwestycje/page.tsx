import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { findInvestments } from '@/lib/queries/investments'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvestmentsPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const params = await searchParams
  const { page, limit } = parsePagination(params)

  const { rows, paginationMeta } = await findInvestments({ page, limit })

  return (
    <PageWrapper title="Inwestycje">
      <div className="mt-6">
        <InvestmentDataTable data={rows} paginationMeta={paginationMeta} />
      </div>
    </PageWrapper>
  )
}
