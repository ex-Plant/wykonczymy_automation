import { redirect, notFound } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUser, getWorkerPeriodBreakdown } from '@/lib/queries/users'
import { findAllTransfersRaw, buildTransferFilters } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchMediaByIds } from '@/lib/queries/media'
import { mapTransferRow, extractInvoiceIds, buildTransferLookups } from '@/lib/tables/transfers'
import { formatPLN } from '@/lib/format-currency'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import {
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { PrintButton } from '@/components/ui/print-button'

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WorkerReportPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

  const { id } = await params
  const sp = await searchParams

  const targetUser = await getUser(id)
  if (!targetUser) notFound()

  const fromParam = typeof sp.from === 'string' ? sp.from : undefined /* & */
  const toParam = typeof sp.to === 'string' ? sp.to : undefined

  if (!fromParam || !toParam) {
    redirect(`/uzytkownicy/${id}`)
  }

  const where = buildTransferFilters(sp, { id: Number(id), isManager: false })

  const [rawDocs, periodBreakdown, refData] = await Promise.all([
    findAllTransfersRaw({ where }),
    getWorkerPeriodBreakdown(id, fromParam, toParam),
    fetchReferenceData(),
  ])

  const invoiceIds = extractInvoiceIds(rawDocs)
  const mediaMap = await fetchMediaByIds(invoiceIds)
  const lookups = buildTransferLookups(refData, mediaMap)
  const rows = rawDocs.map((doc) => mapTransferRow(doc, lookups))

  const periodLabel = `${formatDate(fromParam)} — ${formatDate(toParam)}`

  return (
    <div className="mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{targetUser.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {ROLE_LABELS[targetUser.role as RoleT]?.pl ?? targetUser.role} &middot;{' '}
            {targetUser.email}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">Okres: {periodLabel}</p>
        </div>
        <PrintButton />
      </div>

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <SummaryCard label="Zasilenia" value={formatPLN(periodBreakdown.totalAdvances)} />
        <SummaryCard label="Wydatki" value={formatPLN(periodBreakdown.totalExpenses)} />
        <SummaryCard label="Saldo okresu" value={formatPLN(periodBreakdown.periodSaldo)} />
      </div>

      {/* Full transaction table */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium">Data</th>
            <th className="pb-2 font-medium">Opis</th>
            <th className="pb-2 font-medium">Typ</th>
            <th className="pb-2 font-medium">Metoda</th>
            <th className="pb-2 text-right font-medium">Kwota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-1.5">{formatDate(row.date)}</td>
              <td className="py-1.5">{row.description}</td>
              <td className="py-1.5">
                {TRANSFER_TYPE_LABELS[row.type as TransferTypeT] ?? row.type}
              </td>
              <td className="py-1.5">
                {PAYMENT_METHOD_LABELS[row.paymentMethod as PaymentMethodT] ?? row.paymentMethod}
              </td>
              <td className="py-1.5 text-right font-medium">{formatPLN(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Brak transferów w wybranym okresie.
        </p>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
