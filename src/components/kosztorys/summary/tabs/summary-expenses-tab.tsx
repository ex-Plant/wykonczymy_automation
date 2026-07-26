'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { DecimalField } from '@/components/ui/decimal-field'
import { MaterialsBreakdownTable } from '@/components/kosztorys/summary/tables/materials-breakdown-table'
import { MaterialsTransactionsTable } from '@/components/kosztorys/summary/tables/materials-transactions-table'
import { SlicePie } from '@/components/ui/slice-pie'
import { expensePieSlices } from '@/lib/kosztorys/chart-slices'
import { formatNet } from '@/lib/kosztorys/format'
import type { MaterialsT } from '@/lib/kosztorys/summary-economics'
import { cn } from '@/lib/utils/cn'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { MaterialTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  // Names the transactions list's downloaded invoice archive.
  investmentName: string
  // Materiały in two buckets — a zero total hides the breakdown + controls. The reduction readout
  // quotes only the brutto base, since that is all the toggle can reach.
  materials: MaterialsT
  materialyBreakdown: MaterialyBreakdownRowT[]
  materialTransactions: MaterialTransactionRowT[]
  // Netto column is on show (axis ≠ Brutto) — gates the netto-pricing controls.
  nettoShown: boolean
  // Materiały-netto pricing toggle + its setter (shared panel state — also feeds the Podsumowanie
  // materiały figure, so it stays lifted rather than owned here).
  materialsAsNet: boolean
  onMaterialsAsNetChange: (value: boolean) => void
  // Brutto→netto reduction %, shared panel state seeded from the VAT rate.
  materialsReductionPercent: number
  onMaterialsReductionPercentChange: (value: number) => void
  // Read-only client render — no row links on the transactions list, and no netto-pricing controls:
  // how wydatki are priced is the company's call, so the client only ever sees the resulting figures.
  clientView?: boolean
  // Off on a host that already lists every materiały transaction next to the panel (the investment
  // page's transfers table), where the in-panel list would only repeat it.
  showTransactions?: boolean
  showPie?: boolean
}

// The „Wydatki" view: per-category materiały breakdown, the brutto→netto pricing controls (checkbox +
// reduction %, shared with the Podsumowanie materiały figure), and the flat wydatki transactions list.
export function SummaryExpensesTab({
  investmentId,
  investmentName,
  materials,
  materialyBreakdown,
  materialTransactions,
  nettoShown,
  materialsAsNet,
  onMaterialsAsNetChange,
  materialsReductionPercent,
  onMaterialsReductionPercentChange,
  clientView = false,
  showTransactions = true,
  showPie = true,
}: PropsT) {
  const materialsReduction = materialsReductionPercent / 100
  const materialsReductionAmount = materials.grossBase * materialsReduction
  // The pricing controls are owner-only; the table's `showReduction` is not, so a client still sees
  // the reduced figures the owner's setting produces — just not the switch that produced them.
  const showPricingControls = nettoShown && !clientView

  return (
    <div className="flex w-full flex-col gap-4">
      {materials.grossBase + materials.netBilled !== 0 && (
        <div className="flex flex-col items-start gap-8 lg:flex-row">
          {/* The netto-pricing controls live inside the table's column so they sit directly under it —
              as a sibling of the row they'd be pushed below the taller pie column. */}
          <div className="flex flex-col gap-2">
            <MaterialsBreakdownTable
              rows={materialyBreakdown}
              reduction={materialsReduction}
              showReduction={nettoShown && materialsAsNet}
            />
            {showPricingControls && (
              <label
                className={cn(
                  'flex w-fit cursor-pointer items-center gap-2 text-xs',
                  materialsAsNet ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <Checkbox
                  checked={materialsAsNet}
                  onCheckedChange={(value) => onMaterialsAsNetChange(value === true)}
                />
                Zaznacz jeśli wydatki mają być rozliczane po kwocie netto
              </label>
            )}
            {showPricingControls && materialsAsNet && (
              <>
                <span className="text-muted-foreground text-xs">Stawka netto wydatków</span>
                <div className="flex items-center gap-2">
                  <DecimalField
                    label=""
                    value={materialsReductionPercent}
                    onCommit={(n) => onMaterialsReductionPercentChange(n)}
                  />
                  <span className="text-muted-foreground text-xs">
                    % (−{formatNet(materialsReductionAmount)} zł)
                  </span>
                </div>
              </>
            )}
          </div>
          {showPie && (
            <SlicePie
              caption="Struktura wydatków inwestycyjnych"
              slices={expensePieSlices(materialyBreakdown)}
              formatValue={formatNet}
            />
          )}
        </div>
      )}
      {showTransactions && (
        <MaterialsTransactionsTable
          investmentId={investmentId}
          investmentName={investmentName}
          rows={materialTransactions}
          clientView={clientView}
        />
      )}
    </div>
  )
}
