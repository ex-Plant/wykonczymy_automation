import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import { parsePagination } from '@/lib/pagination'
import { findTransactions, buildTransactionFilters } from '@/lib/queries/transactions'
import { TransactionFilters } from './_components/transaction-filters'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

type PagePropsT = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TransactionsPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')

  const params = await searchParams
  const payload = await getPayload({ config })
  const { page, limit } = parsePagination(params)

  const where = buildTransactionFilters(params, {
    id: user.id,
    isManager: isManagementRole(user.role),
  })

  const [{ rows, paginationMeta }, cashRegisters] = await Promise.all([
    findTransactions(payload, { where, page, limit }),
    payload.find({ collection: 'cash-registers', limit: 100 }),
  ])

  const cashRegisterOptions = cashRegisters.docs.map((d) => ({ id: d.id, name: d.name }))

  return (
    <PageWrapper title="Transakcje">
      <TransactionFilters cashRegisters={cashRegisterOptions} className="mt-6" />

      <TransactionDataTable
        data={rows}
        paginationMeta={paginationMeta}
        baseUrl="/transakcje"
        className="mt-6"
      />
    </PageWrapper>
  )
}
