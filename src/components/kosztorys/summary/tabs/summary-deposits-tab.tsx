'use client'

import { DepositsTable } from '@/components/kosztorys/summary/tables/deposits-table'
import { SlicePie } from '@/components/ui/slice-pie'
import { Description } from '@/components/ui/description'
import { depositPlanePieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'
import type { DepositTransactionRowT } from '@/types/transfers'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

type PropsT = {
  investmentId: number
  rows: DepositTransactionRowT[]
  // Only tryb mieszany settles on both planes, so only there does a wpłata's plane mean anything —
  // it gates the plane column, the per-plane Razem rows and the share pie in one go.
  settlementMode: SettlementModeT
  // Wpłaty split by VAT plane — feeds the netto/brutto share pie.
  paidNet: number
  paidGross: number
  // Read-only client render — no row links.
  preview?: boolean
  showPie?: boolean
}

// The „Wpłaty" block — folded below the settlement in the Podsumowanie view: the deposits list, in
// tryb mieszany with its netto/brutto plane split + share pie, or an empty-state line when there are
// none.
export function SummaryDepositsTab({
  investmentId,
  rows,
  settlementMode,
  paidNet,
  paidGross,
  preview = false,
  showPie = true,
}: PropsT) {
  if (rows.length === 0) return <Description withIcon={false}>Brak wpłat.</Description>

  const showPlaneSplit = settlementMode === 'MIXED'

  return (
    <div className="flex flex-col items-start gap-8 lg:flex-row">
      <div className="flex flex-col gap-1">
        <DepositsTable
          investmentId={investmentId}
          rows={rows}
          preview={preview}
          showPlaneSplit={showPlaneSplit}
        />
        {showPlaneSplit && (
          <Description size="xs" className="mt-2 w-fit max-w-sm text-balance">
            Wpłaty bez oznaczenia netto/brutto są traktowane jako netto.
          </Description>
        )}
      </div>
      {showPie && showPlaneSplit && (
        <SlicePie slices={depositPlanePieSlices(paidNet, paidGross)} formatValue={formatNet} />
      )}
    </div>
  )
}
