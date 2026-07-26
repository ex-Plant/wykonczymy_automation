'use client'

import {
  summaryLineMaterials,
  type MaterialsT,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

// The upper grid: „Robocizna" (pre-rabat) + „Materiały" (one aggregate line — the per-category split
// lives in the Wydatki view), summing to „Łącznie". This is the sheet Podsumowanie split; the
// waterfall below deducts Wpłaty and Rabat from its Łącznie.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  sumaPrac,
  sumaPracMismatch,
  materials,
  combinedNet,
  combined,
  materialsNetRate,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  sumaPrac: SummaryLineT
  sumaPracMismatch?: string
  // Materiały in two buckets; Σ === the per-category Wydatki rows.
  materials: MaterialsT
  combinedNet: number
  combined: MoneyPairT
  // The investment's saved materiały netto rate (null = billed at the raw brutto receipt).
  materialsNetRate: number | null
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      <SummaryRow label="Robocizna" line={sumaPrac} axis={moneyAxis} mismatch={sumaPracMismatch} />
      {materials.grossBase + materials.netBilled !== 0 && (
        <SummaryRow
          label="Materiały"
          line={summaryLineMaterials(materials, combinedNet, materialsNetRate)}
          axis={moneyAxis}
        />
      )}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize />
    </SummaryTable>
  )
}
