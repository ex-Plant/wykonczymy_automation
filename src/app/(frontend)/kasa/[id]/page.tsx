import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CashRegisterDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const payload = await getPayload({ config })

  let register
  try {
    register = await payload.findByID({ collection: 'cash-registers', id, depth: 1 })
  } catch {
    notFound()
  }

  if (!register) notFound()

  // Pagination params
  const pageParam = typeof sp.page === 'string' ? Number(sp.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1
  const limitParam = typeof sp.limit === 'string' ? Number(sp.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const transactions = await payload.find({
    collection: 'transactions',
    where: { cashRegister: { equals: id } },
    sort: '-date',
    depth: 1,
    limit,
    page: currentPage,
  })

  const rows = transactions.docs.map(mapTransactionRow)
  const ownerName =
    typeof register.owner === 'object' && register.owner !== null ? register.owner.name : '—'

  const paginationMeta = {
    currentPage: transactions.page ?? 1,
    totalPages: transactions.totalPages,
    totalDocs: transactions.totalDocs,
    limit,
  }

  return (
    <PageWrapper title={register.name} backHref="/kasa" backLabel="Kasy">
      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground font-medium">Właściciel</dt>
        <dd className="text-foreground">{ownerName}</dd>
      </dl>

      {/* Stat card */}
      <div className="bg-muted/50 border-border mt-6 inline-block rounded-lg border px-6 py-4">
        <p className="text-muted-foreground text-xs font-medium">Saldo</p>
        <p className="text-foreground text-xl font-semibold">{formatPLN(register.balance ?? 0)}</p>
      </div>

      {/* Transactions table */}
      <SectionHeader className="mt-8">Transakcje</SectionHeader>
      <div className="mt-4">
        <TransactionDataTable
          data={rows}
          paginationMeta={paginationMeta}
          excludeColumns={['cashRegister']}
          baseUrl={`/kasa/${id}`}
        />
      </div>
    </PageWrapper>
  )
}
