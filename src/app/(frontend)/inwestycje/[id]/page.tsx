import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { getInvestment } from '@/lib/queries/investments'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { StatCard } from '@/components/ui/stat-card'

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function InvestmentDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const investmentId = Number(id)
  const investment = await getInvestment(id)
  if (!investment) notFound()

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  const infoFields = [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: investment.phone },
    { label: 'Email', value: investment.email },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Status', value: investment.status === 'active' ? 'Aktywna' : 'Zakończona' },
  ]

  return (
    <PageWrapper title={investment.name} backHref="/" backLabel="Kokpit">
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

      <StatCard
        label="Koszty całkowite"
        value={formatPLN(investment.totalCosts ?? 0)}
        className="mt-6 inline-block"
      />

      {/* Transactions table */}
      <SectionHeader className="mt-8">Transfery</SectionHeader>
      <div className="mt-4">
        <Suspense fallback={<TransferTableSkeleton />}>
          <TransferTableServer
            where={transferWhere}
            page={page}
            limit={limit}
            excludeColumns={['investment']}
            baseUrl={`/inwestycje/${id}`}
            filters={{}}
          />
        </Suspense>
      </div>
    </PageWrapper>
  )
}
