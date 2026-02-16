import { redirect } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { findCashRegisters } from '@/lib/queries/cash-registers'
import { CashRegisterDataTable } from '@/components/cash-registers/cash-register-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CashRegistersPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const params = await searchParams
  const { page, limit } = parsePagination(params)

  const { rows, paginationMeta } = await findCashRegisters({ page, limit })

  return (
    <PageWrapper title="Kasy">
      <CashRegisterDataTable data={rows} paginationMeta={paginationMeta} />
    </PageWrapper>
  )
}
