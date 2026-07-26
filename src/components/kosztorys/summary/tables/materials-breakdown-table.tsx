'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import { materialyPair } from '@/lib/kosztorys/summary-economics'
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
// separate frozen „… netto" row per category billed at netto. When a netto reduction is active it
// adds the netto-after-reduction and the zł Różnica columns so the reduction's per-category effect is
// legible; otherwise it's a plain brutto-per-category table.
// `row.net` is the brutto sum (financials-layer field name kept; reinterpreted as gross here).
export function MaterialsBreakdownTable({
  rows,
  netRate,
  showReduction = false,
  caption = 'Wydatki inwestycyjne',
}: {
  rows: MaterialyBreakdownRowT[]
  // The investment's netto rate as a fraction; null = billed at the raw brutto receipt.
  netRate: number | null
  // Show the Netto + Różnica columns (the reduction detail); off = brutto-only category split.
  showReduction?: boolean
  // Names the split — the same per-category shape also renders the settled („wliczone w robociznę")
  // spend, which must never read as part of the investor's wydatki.
  caption?: string
}) {
  const shown = rows.filter((row) => row.net !== 0)
  if (shown.length === 0) return null

  const cols = showReduction
    ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
    : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  // A netBilled row is ALREADY the netto the investor is billed, so the reduction must not touch it —
  // cutting it here would deduct the same VAT a second time. Its Netto column equals its Brutto.
  const netOf = (row: MaterialyBreakdownRowT) =>
    row.origin === 'netBilled' ? row.net : materialyPair(row.net, netRate).net
  const totalGross = shown.reduce((sum, row) => sum + row.net, 0)
  const totalNet = shown.reduce((sum, row) => sum + netOf(row), 0)

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
      <SummaryHeaderCell>{showReduction ? 'Brutto' : 'Kwota brutto'}</SummaryHeaderCell>
      {showReduction && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      {showReduction && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
      {shown.map((row) => (
        <Fragment key={`${row.origin}-${row.id ?? 'korekta'}`}>
          <SummaryLabelCell>{row.label}</SummaryLabelCell>
          <SummaryValueCell>{formatNet(row.net)}</SummaryValueCell>
          {showReduction && <SummaryValueCell>{formatNet(netOf(row))}</SummaryValueCell>}
          {showReduction && (
            <SummaryValueCell className="text-muted-foreground">
              −{formatNet(row.net - netOf(row))}
            </SummaryValueCell>
          )}
        </Fragment>
      ))}
      <SummaryLabelCell className="font-bold">Razem</SummaryLabelCell>
      <SummaryValueCell className="font-bold">{formatNet(totalGross)}</SummaryValueCell>
      {showReduction && (
        <SummaryValueCell className="font-bold">{formatNet(totalNet)}</SummaryValueCell>
      )}
      {showReduction && (
        <SummaryValueCell className="text-muted-foreground font-bold">
          −{formatNet(totalGross - totalNet)}
        </SummaryValueCell>
      )}
    </SummaryTable>
  )
}
