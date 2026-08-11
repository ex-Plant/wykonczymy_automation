'use client'

import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { OptionalLink } from '@/components/ui/optional-link'
import { formatNet } from '@/lib/kosztorys/format'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/constants'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { workerKey } from '@/lib/kosztorys/worker-key'
import type {
  SubcontractorWorkerRowT,
  WorkerSettlementStateT,
} from '@/lib/kosztorys/subcontractor-summary'

// Why this person's „Pozostało" is negative. Spelled out rather than left to the reader, because the
// three cases call for three different responses — and only two of them are anybody's mistake:
// `no_stages` and `overpaid` are wrong and read as alarms, while `no_executed_work` is an ordinary
// prepayment and must stay quiet or it cries wolf on every advance. `settled` has nothing to explain.
const STATE_QUALIFIER: Record<
  WorkerSettlementStateT,
  { text: string; tone: 'muted' | 'error' } | null
> = {
  settled: null,
  overpaid: { text: 'Wypłacono więcej niż wykonano', tone: 'error' },
  no_stages: { text: 'Brak przypisanych etapów', tone: 'error' },
  no_executed_work: { text: 'Przypisane etapy bez wykonanych prac', tone: 'muted' },
  // The residual is not a person, so every qualifier above would be a false sentence about it; its
  // own „Bez przypisanego pracownika" label already says what it is.
  unattributed: null,
}

// A negative „Pozostało do wypłaty" means the opposite of what the column header promises — nothing is
// left to pay out, the person has already been paid too much. Said in the cell rather than left to the
// minus sign, in the same second-row shape the name column uses. The note under the NAME says why this
// happened; this one says what the figure now is.
function RemainingCell({ amount, weight }: { amount: number; weight?: 'medium' | 'bold' }) {
  const isNegative = amount < 0
  return (
    <SummaryValueCell
      tone={isNegative ? 'error' : 'default'}
      weight={weight}
      note={isNegative ? { text: 'nadpłacone', tone: 'error' } : undefined}
    >
      {formatNet(amount)}
    </SummaryValueCell>
  )
}

// The unassigned bucket has nothing to filter on, so it renders as plain text — it is a residual,
// not a person.
export function SubcontractorWorkerTotals({
  investmentId,
  rows,
}: {
  investmentId: number
  rows: SubcontractorWorkerRowT[]
}) {
  // Σ of the columns, not a second derivation of the headline block's figures: if the two ever
  // disagree that is a fact about the data worth seeing, not something to paper over by quoting the
  // same number twice. Rounded for the same reason each row is — summing floats that individually
  // land on zero can still drift a grosz below it, which would paint a square „Razem" red.
  const totals = {
    due: roundToCents(rows.reduce((sum, row) => sum + row.due, 0)),
    paid: roundToCents(rows.reduce((sum, row) => sum + row.paid, 0)),
    remaining: roundToCents(rows.reduce((sum, row) => sum + row.remaining, 0)),
  }

  return (
    <SummaryTable
      cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`}
      className="h-fit w-fit"
    >
      <SummaryHeaderCell variant="label">Podsumowanie pracowników</SummaryHeaderCell>
      <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.due}</SummaryHeaderCell>
      <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.payouts}</SummaryHeaderCell>
      <SummaryHeaderCell>{SUBCONTRACTOR_FIGURE_LABELS.remaining}</SummaryHeaderCell>

      {rows.map((row) => {
        const qualifier = STATE_QUALIFIER[row.state]
        return (
          <div key={workerKey(row.workerId)} className="contents">
            <SummaryLabelCell weight="medium" note={qualifier}>
              <OptionalLink
                href={
                  row.workerId === null
                    ? undefined
                    : investmentTransfersHref(investmentId, {
                        types: ['PAYOUT'],
                        worker: row.workerId,
                      })
                }
              >
                {row.name}
              </OptionalLink>
            </SummaryLabelCell>
            <SummaryValueCell>{formatNet(row.due)}</SummaryValueCell>
            <SummaryValueCell tone="success" weight="medium">
              {formatNet(row.paid)}
            </SummaryValueCell>
            <RemainingCell amount={row.remaining} weight="medium" />
          </div>
        )
      })}

      {/* Closes the table on the same three axes as the rows, so a residual bucket that holds work
          nobody is assigned to reads as part of one balance rather than a fourth unrelated row. */}
      <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
      <SummaryValueCell weight="bold">{formatNet(totals.due)}</SummaryValueCell>
      <SummaryValueCell tone="success" weight="bold">
        {formatNet(totals.paid)}
      </SummaryValueCell>
      <RemainingCell amount={totals.remaining} weight="bold" />
    </SummaryTable>
  )
}
