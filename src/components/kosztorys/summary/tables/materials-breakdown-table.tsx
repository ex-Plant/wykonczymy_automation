'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import { breakdownRowPair } from '@/lib/kosztorys/summary-economics'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// The per-category „Wydatki inwestycyjne" split — each expense category's recorded brutto, plus a
// separate frozen „… netto" row per category billed at netto. A non-null `netRate` adds the netto and
// zł Różnica columns; null keeps it a single-amount-per-category table.
// `row.net` is the brutto sum (financials-layer field name kept; reinterpreted as gross here).
export function MaterialsBreakdownTable({
  rows,
  netRate,
  caption = 'Wydatki inwestycyjne',
}: {
  rows: MaterialyBreakdownRowT[]
  // The rate the Netto column strips, as a fraction — the saved materiały rate, and nothing else.
  // null means materiały settle brutto: the investor is billed the receipt, so a netto column would
  // print an amount nobody owes. That is also how the company-plane („Rozliczone R+M") split renders.
  netRate: number | null
  // Names the split — the same per-category shape also renders the settled („wliczone w robociznę")
  // spend, which must never read as part of the investor's wydatki.
  caption?: string
}) {
  const shown = rows.filter((row) => row.net !== 0)
  if (shown.length === 0) return null

  const showNet = netRate != null
  const cols = showNet
    ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
    : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  const pairOf = (row: MaterialyBreakdownRowT) => breakdownRowPair(row, netRate)
  const totalGross = shown.reduce((sum, row) => sum + pairOf(row).gross, 0)
  const totalNet = shown.reduce((sum, row) => sum + pairOf(row).net, 0)

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
      {/* „Netto" bare, not „bez VAT": whenever a materiały concession is saved this column crosses
            at that rate, not at VAT. It leads because it is the figure the investor is billed;
            brutto is where it was crossed from. */}
      {showNet && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      {/* „Kwota", not „Brutto", where materiały settle brutto: with no rate to cross, there is only
            one plane, and naming it invites the reader to look for a netto twin that isn't there. */}
      <SummaryHeaderCell>{showNet ? 'Brutto' : 'Kwota'}</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
      {shown.map((row) => {
        const pair = pairOf(row)
        return (
          <Fragment key={`${row.origin}-${row.id ?? 'korekta'}`}>
            <SummaryLabelCell>{row.label}</SummaryLabelCell>
            {showNet && <SummaryValueCell>{formatNet(pair.net)}</SummaryValueCell>}
            <SummaryValueCell>{formatNet(pair.gross)}</SummaryValueCell>
            {showNet && (
              <SummaryValueCell className="text-muted-foreground">
                {formatNet(pair.net - pair.gross)}
              </SummaryValueCell>
            )}
          </Fragment>
        )
      })}
      <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
      {showNet && <SummaryValueCell weight="bold">{formatNet(totalNet)}</SummaryValueCell>}
      <SummaryValueCell weight="bold">{formatNet(totalGross)}</SummaryValueCell>
      {showNet && (
        <SummaryValueCell weight="bold" className="text-muted-foreground">
          {formatNet(totalNet - totalGross)}
        </SummaryValueCell>
      )}
    </SummaryTable>
  )
}
