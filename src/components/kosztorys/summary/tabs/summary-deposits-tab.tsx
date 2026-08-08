'use client'

import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import { SlicePie } from '@/components/ui/slice-pie'
import { Description } from '@/components/ui/description'
import { depositPlanePieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'
import type { DepositTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  // Wpłaty split by VAT plane — feeds the netto/brutto share pie.
  paidNet: number
  paidGross: number
  // Read-only client render — no row links.
  preview?: boolean
  showPie?: boolean
}

// The „Wpłaty" block — folded below the settlement in the Podsumowanie view: the sortable deposits
// list with its netto/brutto plane split + share pie, or an empty-state line when there are none.
export function SummaryDepositsTab({
  investmentId,
  rows,
  paidNet,
  paidGross,
  preview = false,
  showPie = true,
}: PropsT) {
  if (rows.length === 0) return <Description withIcon={false}>Brak wpłat.</Description>

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <div className="flex flex-col gap-1">
        <DepositsTable investmentId={investmentId} rows={rows} preview={preview} />
        <Description size="xs" className="mt-2 w-fit max-w-sm text-balance">
          Wpłaty bez oznaczenia netto/brutto są traktowane jako netto.
        </Description>
      </div>
      {showPie && (
        <SlicePie slices={depositPlanePieSlices(paidNet, paidGross)} formatValue={formatNet} />
      )}
    </div>
  )
}
