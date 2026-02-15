import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { findCashRegisters } from '@/lib/queries/cash-registers'
import { CashRegisterDataTable } from './_components/cash-register-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CashRegistersPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const params = await searchParams
  const payload = await getPayload({ config })
  const { page, limit } = parsePagination(params)

  const { rows, paginationMeta } = await findCashRegisters(payload, { page, limit })

  return (
    <PageWrapper title="Kasy">
      <CashRegisterDataTable data={rows} paginationMeta={paginationMeta} />
    </PageWrapper>
  )
}
