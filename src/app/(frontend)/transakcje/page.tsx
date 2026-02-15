import { getCurrentUser } from '@/lib/auth/get-current-user'
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
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')

  const params = await searchParams
  const { page, limit } = parsePagination(params)

  const where = buildTransactionFilters(params, {
    id: user.id,
    isManager: isManagementRole(user.role),
  })

  const [{ rows, paginationMeta }, cashRegisters] = await Promise.all([
    findTransactions({ where, page, limit }),
    findAllCashRegisters(),
  ])

  return (
    <PageWrapper title="Transakcje">
      <TransactionDataTable
        data={rows}
        paginationMeta={paginationMeta}
        baseUrl="/transakcje"
        filters={{ cashRegisters: cashRegisters.map(({ id, name }) => ({ id, name })) }}
        className="mt-6"
      />
    </PageWrapper>
  )
}
