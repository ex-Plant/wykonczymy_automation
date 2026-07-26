'use client'

import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import { SlicePie } from '@/components/ui/slice-pie'
import { Description } from '@/components/ui/description'
import { depositPlanePieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'
import type { DepositTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  // Wpłaty split by VAT plane — feeds the netto/brutto share pie.
  paidNet: number
  paidGross: number
  // Read-only client render — no row links.
  clientView?: boolean
  // Keep only the three Razem buckets — for a host that already lists every wpłata elsewhere.
  totalsOnly?: boolean
}

// The „Wpłaty" view: the sortable deposits list with its netto/brutto plane split + share pie, or an
// empty-state line when there are none.
export function SummaryDepositsTab({
  investmentId,
  rows,
  paidNet,
  paidGross,
  clientView = false,
  totalsOnly = false,
}: PropsT) {
  if (rows.length === 0) return <Description withIcon={false}>Brak wpłat.</Description>

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <div className="flex flex-col gap-1">
        <DepositsTable
          investmentId={investmentId}
          rows={rows}
          clientView={clientView}
          totalsOnly={totalsOnly}
        />
        <Description size="xs" className="mt-2 w-fit max-w-sm text-balance">
          Wpłaty bez oznaczenia netto/brutto są traktowane jako netto.
        </Description>
      </div>
      <SlicePie
        caption="Udział wpłat netto / brutto"
        slices={depositPlanePieSlices(paidNet, paidGross)}
        formatValue={formatNet}
      />
    </div>
  )
}
