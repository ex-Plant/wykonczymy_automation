import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { parsePagination } from '@/lib/pagination'
import { findTransactions, buildTransactionFilters } from '@/lib/queries/transactions'
import { findAllCashRegisters } from '@/lib/queries/cash-registers'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TransactionsPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')

  const params = await searchParams
  const { page, limit } = parsePagination(params)

  const where = buildTransactionFilters(params, {
    id: user.id,
    isManager: isManagementRole(user.role),
  })

  const isManager = isManagementRole(user.role)

  const [{ rows, paginationMeta }, cashRegisters] = await Promise.all([
    findTransactions({ where, page, limit }),
    findAllCashRegisters(),
  ])

  const excludeColumns = isManager
    ? []
    : ['type', 'cashRegister', 'investment', 'worker', 'otherCategory', 'invoice', 'paymentMethod']

  // Worker do not has to see type and cash register selects
  const filters = isManager
    ? { cashRegisters: cashRegisters.map(({ id, name }) => ({ id, name })) }
    : { showTypeFilter: false }

  return (
    <PageWrapper title="Transakcje">
      <TransactionDataTable
        data={rows}
        paginationMeta={paginationMeta}
        excludeColumns={excludeColumns}
        baseUrl="/transakcje"
        filters={filters}
        className="mt-6"
      />
    </PageWrapper>
  )
}
