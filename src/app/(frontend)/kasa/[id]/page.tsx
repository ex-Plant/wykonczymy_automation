import { getPayload } from 'payload'
import config from '@payload-config'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { getCashRegister } from '@/lib/queries/cash-registers'
import { findTransactions } from '@/lib/queries/transactions'
import { formatPLN } from '@/lib/format-currency'
import { TransactionDataTable } from '@/components/transactions/transaction-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'

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
  const { page, limit } = parsePagination(sp)

  const register = await getCashRegister(payload, id)
  if (!register) notFound()

  const { rows, paginationMeta } = await findTransactions(payload, {
    where: { cashRegister: { equals: id } },
    page,
    limit,
  })

  const ownerName =
    typeof register.owner === 'object' && register.owner !== null ? register.owner.name : '—'

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
