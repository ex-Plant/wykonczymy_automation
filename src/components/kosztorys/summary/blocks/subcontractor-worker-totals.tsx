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
import { cn } from '@/lib/utils/cn'
import type {
  SubcontractorWorkerRowT,
  WorkerSettlementStateT,
} from '@/lib/kosztorys/subcontractor-summary'

// Why this person's „Pozostało" is negative. Shown beside the figure rather than left to the reader,
// because the three cases call for three different responses: pay them / assign the etapy / nothing
// is wrong yet. `settled` has nothing to explain.
const STATE_QUALIFIER: Record<WorkerSettlementStateT, string | null> = {
  settled: null,
  overpaid: 'nadpłata',
  no_stages: 'brak przypisanych etapów',
  no_executed_work: 'przypisane etapy bez wykonanych prac',
}

// Należne / wypłacono / pozostało per worker, each name linking into the investment's PAYOUT ledger
// filtered to that worker. The unassigned bucket has nothing to filter on, so it renders as plain
// text — it is a residual, not a person.
export function SubcontractorWorkerTotals({
  investmentId,
  rows,
}: {
  investmentId: number
  rows: SubcontractorWorkerRowT[]
}) {
  return (
    <SummaryTable
      cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`}
      className="h-fit w-fit"
    >
      <SummaryHeaderCell variant="label">Podsumowanie pracowników</SummaryHeaderCell>
      <SummaryHeaderCell>Należne</SummaryHeaderCell>
      <SummaryHeaderCell>Wypłacono</SummaryHeaderCell>
      <SummaryHeaderCell>Pozostało</SummaryHeaderCell>

      {rows.map((row) => {
        const qualifier = STATE_QUALIFIER[row.state]
        return (
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
              {qualifier && (
                <span className="text-muted-foreground ml-2 text-xs font-normal">{qualifier}</span>
              )}
            </SummaryLabelCell>
            <SummaryValueCell>{formatNet(row.due)}</SummaryValueCell>
            <SummaryValueCell className="text-chart-green font-medium">
              {formatNet(row.paid)}
            </SummaryValueCell>
            <SummaryValueCell className={cn('font-medium', row.remaining < 0 && 'text-destructive')}>
              {formatNet(row.remaining)}
            </SummaryValueCell>
          </div>
        )
      })}
    </SummaryTable>
  )
}
