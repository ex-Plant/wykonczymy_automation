import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { Description } from '@/components/ui/description'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import type { EquipmentEventRowT, EquipmentTargetT } from '@/lib/equipment/types'

const targetLabel = (target: EquipmentTargetT): string =>
  target.kind === 'service' ? `Serwis: ${target.name}` : target.name

const COLS = `${SUMMARY_LABEL_COL} 1fr 1fr 9rem`

/**
 * The log, newest first — the answer to „a kto to miał wcześniej". Read-only by design: an event is
 * a fact that happened, so a mistake is corrected by recording the correction, not by rewriting
 * history.
 */
export function EquipmentHistory({ history }: { history: EquipmentEventRowT[] }) {
  if (history.length === 0) {
    return <Description>Brak wpisów — sprzęt nie był jeszcze nikomu przekazany.</Description>
  }

  return (
    <SummaryTable cols={COLS}>
      <SummaryHeaderCell variant="label">Data</SummaryHeaderCell>
      <SummaryHeaderCell variant="label">Gdzie trafił</SummaryHeaderCell>
      <SummaryHeaderCell variant="label">Inwestycja</SummaryHeaderCell>
      <SummaryHeaderCell>Koszt</SummaryHeaderCell>

      {history.map((event) => (
        <div key={event.id} className="contents">
          <SummaryLabelCell>{formatPLDate(event.occurredAt)}</SummaryLabelCell>
          <SummaryLabelCell note={event.note ? { text: event.note, tone: 'muted' } : null}>
            {targetLabel(event.target)}
          </SummaryLabelCell>
          <SummaryLabelCell>{event.investmentName || '—'}</SummaryLabelCell>
          <SummaryValueCell>{formatPLNOrDash(event.cost)}</SummaryValueCell>
        </div>
      ))}
    </SummaryTable>
  )
}
