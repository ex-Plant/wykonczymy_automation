import { redirect, notFound } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { parsePagination } from '@/lib/pagination'
import { getCashRegister } from '@/lib/queries/cash-registers'
import { findTransfersRaw, buildTransferFilters } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchMediaByIds } from '@/lib/queries/media'
import { mapTransferRow, extractInvoiceIds, buildTransferLookups } from '@/lib/tables/transfers'
import { formatPLN } from '@/lib/format-currency'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SectionHeader } from '@/components/ui/section-header'
import { StatCard } from '@/components/ui/stat-card'

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CashRegisterDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const register = await getCashRegister(id)
  if (!register) notFound()

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })

  const [rawTxResult, refData] = await Promise.all([
    findTransfersRaw({
      where: { ...urlFilters, cashRegister: { equals: id } },
      page,
      limit,
    }),
    fetchReferenceData(),
  ])

  const invoiceIds = extractInvoiceIds(rawTxResult.docs)
  const mediaMap = await fetchMediaByIds(invoiceIds)
  const lookups = buildTransferLookups(refData, mediaMap)
  const rows = rawTxResult.docs.map((doc) => mapTransferRow(doc, lookups))
  const paginationMeta = rawTxResult.paginationMeta

  const ownerName =
    typeof register.owner === 'object' && register.owner !== null ? register.owner.name : '—'

  return (
    <PageWrapper title={register.name} backHref="/" backLabel="Kokpit">
      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground font-medium">Właściciel</dt>
        <dd className="text-foreground">{ownerName}</dd>
      </dl>

      <StatCard label="Saldo" value={formatPLN(register.balance ?? 0)} className="mt-6" />

      {/* Transactions table */}
      <SectionHeader className="mt-8">Transfery</SectionHeader>
      <div className="mt-4">
        <TransferDataTable
          data={rows}
          paginationMeta={paginationMeta}
          excludeColumns={['cashRegister']}
          baseUrl={`/kasa/${id}`}
          filters={{}}
        />
      </div>
    </PageWrapper>
  )
}
