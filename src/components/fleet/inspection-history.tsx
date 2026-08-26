import { Fragment } from 'react'
import { Paperclip } from 'lucide-react'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { formatKm, formatKmOrDash } from '@/lib/utils/format-distance'
import type { InspectionHistoryEntryT, VehicleDetailT } from '@/types/fleet'

// Same CSS-grid table as the kosztorys summary blocks (SummaryTable + Label/Value cells), so the two
// read as one app rather than two. Every section pins the same leading tracks, which keeps Data and
// Następny termin aligned down the page even where the trailing columns differ.

const EMPTY = '—'

/**
 * The trailing columns are dropped for a section that has nothing to put in them: ubezpieczyciel and
 * nr polisy belong to OC, „Wymiana przy" to the oil change, and most entries carry no attachment. An
 * always-present column of dashes costs width and says nothing.
 *
 * Driven by the entries rather than by the section's type so a polisa with no insurer recorded — the
 * przyczepa's — drops just that one column instead of both.
 */
const columnsFor = (entries: InspectionHistoryEntryT[]) => ({
  insurer: entries.some((entry) => entry.insurer !== ''),
  policyNumber: entries.some((entry) => entry.policyNumber !== ''),
  oilTarget: entries.some((entry) => entry.nextDueOdometer !== null),
  attachments: entries.some((entry) => entry.attachmentCount > 0),
})

function HistoryTable({ entries }: { entries: InspectionHistoryEntryT[] }) {
  const shown = columnsFor(entries)
  const cols = [
    SUMMARY_LABEL_COL,
    SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
    SUMMARY_VALUE_COL,
    ...(shown.insurer ? [SUMMARY_VALUE_COL] : []),
    ...(shown.policyNumber ? [SUMMARY_VALUE_COL] : []),
    ...(shown.oilTarget ? [SUMMARY_VALUE_COL] : []),
    ...(shown.attachments ? [SUMMARY_VALUE_COL] : []),
  ].join(' ')

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">Data</SummaryHeaderCell>
      <SummaryHeaderCell>Następny termin</SummaryHeaderCell>
      <SummaryHeaderCell>Przebieg</SummaryHeaderCell>
      <SummaryHeaderCell>Od poprzedniego</SummaryHeaderCell>
      <SummaryHeaderCell>Koszt</SummaryHeaderCell>
      {shown.insurer && <SummaryHeaderCell>Ubezpieczyciel</SummaryHeaderCell>}
      {shown.policyNumber && <SummaryHeaderCell>Nr polisy</SummaryHeaderCell>}
      {shown.oilTarget && <SummaryHeaderCell>Wymiana przy</SummaryHeaderCell>}
      {shown.attachments && <SummaryHeaderCell>Załączniki</SummaryHeaderCell>}

      {entries.map((entry) => (
        <Fragment key={entry.id}>
          <SummaryLabelCell
            weight="medium"
            className="tabular-nums"
            note={entry.note ? { text: entry.note } : null}
          >
            {formatPLDate(entry.performedAt)}
          </SummaryLabelCell>

          <SummaryValueCell>
            {entry.nextDueAt ? formatPLDate(entry.nextDueAt) : EMPTY}
          </SummaryValueCell>

          <SummaryValueCell>{formatKmOrDash(entry.odometer)}</SummaryValueCell>

          <SummaryValueCell>
            {entry.kmSincePrevious !== null ? `+${formatKm(entry.kmSincePrevious)}` : EMPTY}
          </SummaryValueCell>

          <SummaryValueCell>{formatPLNOrDash(entry.cost)}</SummaryValueCell>

          {shown.insurer && <SummaryValueCell>{entry.insurer || EMPTY}</SummaryValueCell>}

          {shown.policyNumber && <SummaryValueCell>{entry.policyNumber || EMPTY}</SummaryValueCell>}

          {shown.oilTarget && (
            <SummaryValueCell>{formatKmOrDash(entry.nextDueOdometer)}</SummaryValueCell>
          )}

          {shown.attachments && (
            <SummaryValueCell>
              {entry.attachmentCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" />
                  {entry.attachmentCount}
                </span>
              ) : (
                EMPTY
              )}
            </SummaryValueCell>
          )}
        </Fragment>
      ))}
    </SummaryTable>
  )
}

/**
 * `hasWindow` says a date window is set, which is a different claim from an empty section: a car with
 * no OC at all must keep saying so even while a window is active, or the user reads „nothing in July"
 * and stops looking.
 */
export function InspectionHistory({
  historyByType,
  hasWindow,
}: Pick<VehicleDetailT, 'historyByType'> & { hasWindow: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {INSPECTION_TYPES.map((type) => (
        <section key={type}>
          <h2 className="mb-2 text-sm font-semibold">{INSPECTION_TYPE_LABELS[type].pl}</h2>

          {historyByType[type].length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {hasWindow ? 'Brak wpisów w wybranym okresie' : 'Brak wpisów'}
            </p>
          ) : (
            <HistoryTable entries={historyByType[type]} />
          )}
        </section>
      ))}
    </div>
  )
}
