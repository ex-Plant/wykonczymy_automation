'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import { billedMaterialsPair } from '@/lib/kosztorys/summary-economics'
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
// zł Różnica columns; null keeps it a plain brutto-per-category table.
// `row.net` is the brutto sum (financials-layer field name kept; reinterpreted as gross here).
export function MaterialsBreakdownTable({
  rows,
  netRate,
  caption = 'Wydatki inwestycyjne',
}: {
  rows: MaterialyBreakdownRowT[]
  // The rate the Netto column strips, as a fraction. On the investor's split this is a *presentation*
  // figure — the materiały rate when the concession is on, otherwise the investment's VAT — so the
  // column stands whether or not anything is actually being conceded. null = no netto column at all,
  // which is how the company-plane („Rozliczone R+M") split renders.
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
  // A netBilled row is ALREADY the netto the investor is billed, so the reduction must not touch it —
  // cutting it here would deduct the same VAT a second time. Its Netto column equals its Brutto.
  const netOf = (row: MaterialyBreakdownRowT) =>
    row.origin === 'netBilled' ? row.net : billedMaterialsPair(row.net, netRate).net
  const totalGross = shown.reduce((sum, row) => sum + row.net, 0)
  const totalNet = shown.reduce((sum, row) => sum + netOf(row), 0)
  const netPercent = Math.round((netRate ?? 0) * 100)

  return (
    <div className="flex flex-col gap-1">
      <SummaryTable cols={cols} className="w-fit">
        <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
        <SummaryHeaderCell>{showNet ? 'Brutto' : 'Kwota brutto'}</SummaryHeaderCell>
        {showNet && <SummaryHeaderCell>Netto ({netPercent}%)</SummaryHeaderCell>}
        {showNet && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
        {shown.map((row) => (
          <Fragment key={`${row.origin}-${row.id ?? 'korekta'}`}>
            <SummaryLabelCell>{row.label}</SummaryLabelCell>
            <SummaryValueCell>{formatNet(row.net)}</SummaryValueCell>
            {showNet && <SummaryValueCell>{formatNet(netOf(row))}</SummaryValueCell>}
            {showNet && (
              <SummaryValueCell className="text-muted-foreground">
                −{formatNet(row.net - netOf(row))}
              </SummaryValueCell>
            )}
          </Fragment>
        ))}
        <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
        <SummaryValueCell weight="bold">{formatNet(totalGross)}</SummaryValueCell>
        {showNet && <SummaryValueCell weight="bold">{formatNet(totalNet)}</SummaryValueCell>}
        {showNet && (
          <SummaryValueCell weight="bold" className="text-muted-foreground">
            −{formatNet(totalGross - totalNet)}
          </SummaryValueCell>
        )}
      </SummaryTable>
      {showNet && (
        <span className="text-muted-foreground text-xs">Netto = brutto ÷ (1 + {netPercent}%)</span>
      )}
    </div>
  )
}
