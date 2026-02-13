import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { formatPLN } from '@/lib/format-currency'
import { mapTransactionRow } from '@/lib/transactions/map-transaction-row'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

const DEFAULT_LIMIT = 20
const ALLOWED_LIMITS = [20, 50, 100]

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvestmentDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUser()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const payload = await getPayload({ config })

  let investment
  try {
    investment = await payload.findByID({ collection: 'investments', id })
  } catch {
    notFound()
  }

  if (!investment) notFound()

  // Pagination params
  const pageParam = typeof sp.page === 'string' ? Number(sp.page) : 1
  const currentPage = pageParam > 0 ? pageParam : 1
  const limitParam = typeof sp.limit === 'string' ? Number(sp.limit) : DEFAULT_LIMIT
  const limit = ALLOWED_LIMITS.includes(limitParam) ? limitParam : DEFAULT_LIMIT

  const transactions = await payload.find({
    collection: 'transactions',
    where: { investment: { equals: id } },
    sort: '-date',
    depth: 1,
    limit,
    page: currentPage,
  })

  const rows = transactions.docs.map(mapTransactionRow)

  const infoFields = [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: investment.phone },
    { label: 'Email', value: investment.email },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Status', value: investment.status === 'active' ? 'Aktywna' : 'Zakończona' },
  ]

  const paginationMeta = {
    currentPage: transactions.page ?? 1,
    totalPages: transactions.totalPages,
    totalDocs: transactions.totalDocs,
    limit,
  }

  return (
    <PageWrapper title={investment.name} backHref="/inwestycje" backLabel="Inwestycje">
      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {infoFields
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground font-medium">{f.label}</dt>
              <dd className="text-foreground">{f.value}</dd>
            </div>
          ))}
      </dl>

      {/* Stat card */}
      <div className="bg-muted/50 border-border mt-6 inline-block rounded-lg border px-6 py-4">
        <p className="text-muted-foreground text-xs font-medium">Koszty całkowite</p>
        <p className="text-foreground text-xl font-semibold">
          {formatPLN(investment.totalCosts ?? 0)}
        </p>
      </div>

      {/* Transactions table */}
      <h2 className="text-foreground mt-8 text-lg font-semibold">Transakcje</h2>
      <div className="mt-4">
        <TransactionDataTable
          data={rows}
          paginationMeta={paginationMeta}
          excludeColumns={['investment']}
          baseUrl={`/inwestycje/${id}`}
        />
      </div>
    </PageWrapper>
  )
}
