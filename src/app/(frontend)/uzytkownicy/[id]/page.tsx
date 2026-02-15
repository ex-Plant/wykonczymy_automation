import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { parsePagination } from '@/lib/pagination'
import { getUser, getUserSaldo } from '@/lib/queries/users'
import { findTransactions } from '@/lib/queries/transactions'
import { findActiveInvestments } from '@/lib/queries/investments'
import { findAllCashRegisters } from '@/lib/queries/cash-registers'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { ZeroSaldoDialog } from '@/components/settlements/zero-saldo-dialog'
import { StatCard } from '@/components/ui/stat-card'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'

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
  const { page, limit } = parsePagination(sp)

  const targetUser = await getUser(id)
  if (!targetUser) notFound()

  const [{ rows, paginationMeta }, saldo, activeInvestments, cashRegisters, managerRegisterIds] =
    await Promise.all([
      findTransactions({
        where: { worker: { equals: id } },
        page,
        limit,
      }),
      getUserSaldo(id),
      findActiveInvestments(),
      findAllCashRegisters(),
      getUserCashRegisterIds(user.id, user.role),
    ])

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
            investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
            cashRegisters: cashRegisters.map((c) => ({ id: c.id, name: c.name })),
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
