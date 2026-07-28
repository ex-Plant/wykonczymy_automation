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

// The sheet's Podsumowanie split: „Robocizna" is pre-rabat, „Rabat" takes it down to the executed
// value, and „Materiały" is one aggregate line (the per-category split lives in the Wydatki view).
// Every row here is a real term of „Łącznie" — the reader can add the column down. Wpłaty are the
// only thing deducted below.
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
  materialsNetRate,
  scopeMarked = false,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  sumaPrac: SummaryLineT
  sumaPracMismatch?: string
  // Already negative, built by the caller (it owns the VAT rate). Undefined hides the row. Sits
  // directly under Robocizna because that is the figure it reduces — „Robocizna przed rabatem"
  // minus this IS the executed robocizna folded into Łącznie.
  rabat?: MoneyPairT
  rabatMismatch?: string
  // Materiały in two buckets; Σ === the per-category Wydatki rows.
  materials: MaterialsT
  combinedNet: number
  combined: MoneyPairT
  // The investment's saved materiały netto rate (null = billed at the raw brutto receipt).
  materialsNetRate: number | null
  // Star the kosztorys-plane rows — Materiały comes off the transactions and stays bare.
  scopeMarked?: boolean
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      {/* Label stays bare „Robocizna" — it is the same pre-rabat figure the investment page's
          „z kosztorysu" block calls Robocizna, and the Rabat row right below removes any doubt. */}
      <SummaryRow
        label="Robocizna"
        line={sumaPrac}
        axis={moneyAxis}
        mismatch={sumaPracMismatch}
        scopeMarked={scopeMarked}
      />
      {rabat && (
        <SummaryRow
          label="Rabat"
          line={rabat}
          axis={moneyAxis}
          mismatch={rabatMismatch}
          discount
          scopeMarked={scopeMarked}
        />
      )}
      {materials.grossBase + materials.netBilled !== 0 && (
        <SummaryRow
          label="Materiały"
          line={summaryLineMaterials(materials, combinedNet, materialsNetRate)}
          axis={moneyAxis}
        />
      )}
      <SummaryRow
        label="Łącznie"
        line={combined}
        axis={moneyAxis}
        emphasize
        scopeMarked={scopeMarked}
      />
    </SummaryTable>
  )
}
