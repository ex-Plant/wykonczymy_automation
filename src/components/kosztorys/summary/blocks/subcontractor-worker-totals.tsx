'use client'

import Link from 'next/link'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { workerKey } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorPayoutRowT } from '@/types/transfers'

// Σ wypłat per worker, each name linking into the investment's PAYOUT ledger filtered to that worker.
// The null-worker bucket has nothing to filter on, so it renders as plain text.
export function SubcontractorWorkerTotals({
  investmentId,
  rows,
}: {
  investmentId: number
  rows: SubcontractorPayoutRowT[]
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="h-fit w-fit">
      <SummaryHeaderCell variant="label">Podsumowanie pracowników</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {rows.map((row) => (
        <div key={workerKey(row.workerId)} className="contents">
          <SummaryLabelCell className="font-medium">
            {row.workerId === null ? (
              row.name
            ) : (
              <Link
                href={investmentTransfersHref(investmentId, {
                  types: ['PAYOUT'],
                  worker: row.workerId,
                })}
                className="hover:underline"
              >
                {row.name}
              </Link>
            )}
          </SummaryLabelCell>
          <SummaryValueCell className="text-chart-green font-medium">
            {formatNet(row.total)}
          </SummaryValueCell>
        </div>
      ))}
    </SummaryTable>
  )
}
