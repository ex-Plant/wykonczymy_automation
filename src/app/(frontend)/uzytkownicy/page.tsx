import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { sumAllWorkerSaldos } from '@/lib/db/sum-transactions'
import type { RoleT } from '@/lib/auth/roles'
import { UserDataTable } from '@/components/users/user-data-table'
import type { UserRowT } from '@/lib/users/types'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CACHE_TAGS } from '@/lib/cache/tags'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const sp = await searchParams
  const payload = await getPayload({ config })

  const pageParam = typeof sp.page === 'string' ? Number(sp.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1

  const limitParam = typeof sp.limit === 'string' ? Number(sp.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const getCachedSaldos = unstable_cache(
    async () => {
      const pl = await getPayload({ config })
      const map = await sumAllWorkerSaldos(pl)
      return Object.fromEntries(map)
    },
    ['all-worker-saldos'],
    { tags: [CACHE_TAGS.transactions] },
  )

  const [users, saldoRecord] = await Promise.all([
    payload.find({ collection: 'users', sort: 'name', limit, page: currentPage }),
    getCachedSaldos(),
  ])

  const saldoMap = new Map(Object.entries(saldoRecord).map(([k, v]) => [Number(k), v]))

  const rows: UserRowT[] = users.docs.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as RoleT,
    saldo: saldoMap.get(u.id) ?? 0,
  }))

  const paginationMeta = {
    currentPage: users.page ?? 1,
    totalPages: users.totalPages,
    totalDocs: users.totalDocs,
    limit,
  }

  return (
    <PageWrapper title="Użytkownicy">
      <div className="mt-6">
        <UserDataTable data={rows} paginationMeta={paginationMeta} />
      </div>
    </PageWrapper>
  )
}
