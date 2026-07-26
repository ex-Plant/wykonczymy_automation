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

// The upper grid: „Robocizna" (pre-rabat) − „Rabat" + „Materiały" (one aggregate line — the
// per-category split lives in the Wydatki view), summing to „Łącznie". This is the sheet
// Podsumowanie split; the waterfall below deducts from its Łącznie.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  sumaPrac,
  sumaPracMismatch,
  rabat,
  rabatMismatch,
  materials,
  combinedNet,
  combined,
  vatRate,
  deriveMaterialsNet,
  materialsReduction,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  sumaPrac: SummaryLineT
  sumaPracMismatch?: string
  // The rabat as a NEGATIVE pair, already built by the caller (it owns the VAT rate). Undefined
  // hides the row entirely — there is no rabat worth showing.
  rabat?: MoneyPairT
  rabatMismatch?: string
  // Materiały in two buckets; Σ === the per-category Wydatki rows.
  materials: MaterialsT
  combinedNet: number
  combined: MoneyPairT
  vatRate: number
  // Price the materiały brutto base as brutto − VAT (true) or keep it at raw brutto (false).
  deriveMaterialsNet: boolean
  // When set (and deriveMaterialsNet), netto = brutto × (1 − materialsReduction) instead of the
  // VAT-strip default (temporary client-side experiment).
  materialsReduction?: number
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      <SummaryRow label="Robocizna" line={sumaPrac} axis={moneyAxis} mismatch={sumaPracMismatch} />
      {rabat && (
        <SummaryRow label="Rabat" line={rabat} axis={moneyAxis} mismatch={rabatMismatch} discount />
      )}
      {materials.grossBase + materials.netBilled !== 0 && (
        <SummaryRow
          label="Materiały"
          line={summaryLineMaterials(
            materials,
            combinedNet,
            vatRate,
            deriveMaterialsNet,
            materialsReduction,
          )}
          axis={moneyAxis}
        />
      )}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize />
    </SummaryTable>
  )
}
