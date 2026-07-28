'use client'

import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { PlaneUnconfirmedBadge } from '@/components/ui/plane-unconfirmed-badge'
import { formatNet } from '@/lib/kosztorys/format'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import type { SubcontractorSummaryT } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/settlement'
import { cn } from '@/lib/utils/cn'

// Explains the badge: an etap with no rozliczenie belongs to neither crew, so it lands in neither
// amount — „Suma wykonanej pracy" UNDERstates the executed work until every etap is assigned.
const UNCONFIRMED_PLANE_HINT =
  'Niektóre etapy nie mają potwierdzonego rozliczenia — nie wchodzą do żadnej z kwot, więc suma jest niższa niż faktycznie wykonana praca.'

// The three totals that carry the settlement: należne, wypłacone, pozostało. One „Kwota" column
// throughout, no netto/brutto axis (EX-558: subcontractors are paid without VAT).
export function SubcontractorHeadlineSummary({
  summary,
  due,
  showPlanes,
}: {
  summary: SubcontractorSummaryT
  due: SubcontractorDueByPlaneT
  showPlanes: boolean
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
      <SummaryHeaderCell variant="label">Podsumowanie podwykonawców</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {/* Split by plane: each etap valued at its own price, so Z + Bez = razem exactly. Shown even
          when one side is 0, so the reader sees the settlement is plane-aware. */}
      {showPlanes && (
        <div className="contents">
          <SummaryLabelCell>{PLANE_LABELS.w_tools}</SummaryLabelCell>
          <SummaryValueCell>{formatNet(due.wTools)}</SummaryValueCell>

          <SummaryLabelCell>{PLANE_LABELS.own_tools}</SummaryLabelCell>
          <SummaryValueCell>{formatNet(due.ownTools)}</SummaryValueCell>
        </div>
      )}

      <SummaryLabelCell className="flex items-center gap-x-2 font-bold">
        Suma wykonanej pracy
        {due.hasUnconfirmedPlane && (
          <PlaneUnconfirmedBadge content={UNCONFIRMED_PLANE_HINT} className="size-4" />
        )}
      </SummaryLabelCell>
      <SummaryValueCell className="font-bold">{formatNet(due.combined)}</SummaryValueCell>

      <SummaryLabelCell className="font-medium">Zaliczki (wypłaty) razem</SummaryLabelCell>
      <SummaryValueCell className="text-chart-green font-medium">
        {formatNet(summary.payoutsTotal)}
      </SummaryValueCell>

      {/* Pozostało do wypłaty = należne − zaliczki. Negative = the crew has been overpaid — an
          anomaly, so it reads red; a normal positive „still owed" stays neutral bold. */}
      <SummaryLabelCell className="font-bold">Pozostało do wypłaty</SummaryLabelCell>
      <SummaryValueCell className={cn('font-bold', summary.remaining < 0 && 'text-destructive')}>
        {formatNet(summary.remaining)}
      </SummaryValueCell>
    </SummaryTable>
  )
}
