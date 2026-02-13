import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/collections/users'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { ZeroSaldoDialog } from '@/components/settlements/zero-saldo-dialog'
import { PageWrapper } from '@/components/ui/page-wrapper'

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

  // Fetch paginated transactions + saldo totals + reference data for zero saldo
  const [transactions, allAdvances, allExpenses, activeInvestments, cashRegisters] =
    await Promise.all([
      payload.find({
        collection: 'transactions',
        where: { worker: { equals: id } },
        sort: '-date',
        depth: 1,
        limit,
        page: currentPage,
      }),
      payload.find({
        collection: 'transactions',
        where: { worker: { equals: id }, type: { equals: 'ADVANCE' } },
        pagination: false,
        depth: 0,
      }),
      payload.find({
        collection: 'transactions',
        where: { worker: { equals: id }, type: { equals: 'EMPLOYEE_EXPENSE' } },
        pagination: false,
        depth: 0,
      }),
      payload.find({
        collection: 'investments',
        where: { status: { equals: 'active' } },
        pagination: false,
        depth: 0,
      }),
      payload.find({ collection: 'cash-registers', pagination: false, depth: 0 }),
    ])

  const advancesSum = allAdvances.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const expensesSum = allExpenses.docs.reduce((sum, tx) => sum + tx.amount, 0)
  const saldo = advancesSum - expensesSum

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
        <dd className="text-foreground">{ROLE_LABELS[targetUser.role as RoleT]?.pl ?? targetUser.role}</dd>
      </dl>

      {/* Stat card + zero saldo */}
      <div className="mt-6 flex items-end gap-4">
        <div className="bg-muted/50 border-border inline-block rounded-lg border px-6 py-4">
          <p className="text-muted-foreground text-xs font-medium">Saldo</p>
          <p className="text-foreground text-xl font-semibold">{formatPLN(saldo)}</p>
        </div>
        <ZeroSaldoDialog
          saldo={saldo}
          workerId={targetUser.id}
          referenceData={{
            investments: activeInvestments.docs.map((i) => ({ id: i.id, name: i.name })),
            cashRegisters: cashRegisters.docs.map((c) => ({ id: c.id, name: c.name })),
          }}
        />
      </div>

      {/* Transactions table */}
      <h2 className="text-foreground mt-8 text-lg font-semibold">Transakcje</h2>
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
