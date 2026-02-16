import { redirect } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { findUsersWithSaldos } from '@/lib/queries/users'
import { UserDataTable } from '@/components/users/user-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const { rows, paginationMeta } = await findUsersWithSaldos({ page, limit })

  return (
    <PageWrapper title="Użytkownicy">
      <div className="mt-6">
        <UserDataTable data={rows} paginationMeta={paginationMeta} />
      </div>
    </PageWrapper>
  )
}
