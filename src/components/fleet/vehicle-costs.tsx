import { Fragment } from 'react'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { summariseCosts } from '@/lib/fleet/costs'
import { INSPECTION_TYPE_LABELS, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import type { InspectionHistoryEntryT } from '@/types/fleet'

// Both grids run the same tracks, so the totals and the itemisation line up column for column.
const COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`

/**
 * What the car has cost: the totals first, then every entry behind them.
 */
export function VehicleCosts({
  historyByType,
}: {
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>
}) {
  const { byType, total, entries } = summariseCosts(historyByType)

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-xs">Brak zapisanych kosztów</p>
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Podsumowanie</h2>

        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Rodzaj</SummaryHeaderCell>
          <SummaryHeaderCell>Wpisy</SummaryHeaderCell>
          <SummaryHeaderCell>Koszt</SummaryHeaderCell>

          {byType.map((bucket) => (
            <Fragment key={bucket.type}>
              <SummaryLabelCell>{INSPECTION_TYPE_LABELS[bucket.type].pl}</SummaryLabelCell>
              <SummaryValueCell>{bucket.count}</SummaryValueCell>
              <SummaryValueCell>{formatPLN(bucket.total)}</SummaryValueCell>
            </Fragment>
          ))}

          <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
          <SummaryValueCell weight="bold">{entries.length}</SummaryValueCell>
          <SummaryValueCell weight="bold">{formatPLN(total)}</SummaryValueCell>
        </SummaryTable>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Szczegóły</h3>

        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Data</SummaryHeaderCell>
          <SummaryHeaderCell>Rodzaj</SummaryHeaderCell>
          <SummaryHeaderCell>Koszt</SummaryHeaderCell>

          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <SummaryLabelCell className="tabular-nums">
                {formatPLDate(entry.performedAt)}
              </SummaryLabelCell>
              <SummaryValueCell>{INSPECTION_TYPE_LABELS[entry.type].pl}</SummaryValueCell>
              <SummaryValueCell>{formatPLN(entry.cost)}</SummaryValueCell>
            </Fragment>
          ))}
        </SummaryTable>
      </div>
    </section>
  )
}
