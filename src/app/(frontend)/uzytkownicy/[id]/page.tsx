import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { sumEmployeeSaldo } from '@/lib/db/sum-transactions'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { ZeroSaldoDialog } from '@/components/settlements/zero-saldo-dialog'
import { StatCard } from '@/components/ui/stat-card'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { CACHE_TAGS } from '@/lib/cache/tags'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

const EXCLUDE_COLUMNS = ['investment', 'worker', 'otherCategory', 'invoice']

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UserDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const payload = await getPayload({ config })

  let targetUser
  try {
    targetUser = await payload.findByID({ collection: 'users', id })
  } catch {
    notFound()
  }

  if (!targetUser) notFound()

  const pageParam = typeof sp.page === 'string' ? Number(sp.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1

  const limitParam = typeof sp.limit === 'string' ? Number(sp.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const getCachedSaldo = unstable_cache(
    async (workerId: number) => {
      const pl = await getPayload({ config })
      return sumEmployeeSaldo(pl, workerId)
    },
    ['employee-saldo', id],
    { tags: [CACHE_TAGS.transactions] },
  )

  // Fetch paginated transactions + saldo + reference data for zero saldo
  const [transactions, saldo, activeInvestments, cashRegisters, managerRegisterIds] =
    await Promise.all([
      payload.find({
        collection: 'transactions',
        where: { worker: { equals: id } },
        sort: '-date',
        depth: 1,
        limit,
        page: currentPage,
      }),
      getCachedSaldo(Number(id)),
      payload.find({
        collection: 'investments',
        where: { status: { equals: 'active' } },
        pagination: false,
        depth: 0,
      }),
      payload.find({ collection: 'cash-registers', pagination: false, depth: 0 }),
      getUserCashRegisterIds(user.id, user.role),
    ])

  const rows = transactions.docs.map(mapTransactionRow)

  const paginationMeta = {
    currentPage: transactions.page ?? 1,
    totalPages: transactions.totalPages,
    totalDocs: transactions.totalDocs,
    limit,
  }

  return (
    <PageWrapper title={targetUser.name} backHref="/uzytkownicy" backLabel="Użytkownicy">
      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground font-medium">Email</dt>
        <dd className="text-foreground">{targetUser.email}</dd>
        <dt className="text-muted-foreground font-medium">Rola</dt>
        <dd className="text-foreground">
          {ROLE_LABELS[targetUser.role as RoleT]?.pl ?? targetUser.role}
        </dd>
      </dl>

      {/* Stat card + zero saldo */}
      <div className="mt-6 flex items-end gap-4">
        <StatCard label="Saldo" value={formatPLN(saldo)} />
        <ZeroSaldoDialog
          saldo={saldo}
          workerId={targetUser.id}
          managerCashRegisterId={managerRegisterIds?.[0]}
          referenceData={{
            investments: activeInvestments.docs.map((i) => ({ id: i.id, name: i.name })),
            cashRegisters: cashRegisters.docs.map((c) => ({ id: c.id, name: c.name })),
          }}
        />
      </div>

      {/* Transactions table */}
      <SectionHeader className="mt-8">Transakcje</SectionHeader>
      <div className="mt-4">
        <TransactionDataTable
          data={rows}
          paginationMeta={paginationMeta}
          excludeColumns={EXCLUDE_COLUMNS}
          baseUrl={`/uzytkownicy/${id}`}
        />
      </div>
    </PageWrapper>
  )
}
