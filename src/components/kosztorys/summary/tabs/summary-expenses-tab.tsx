'use client'

import { MaterialsBreakdownTable } from '@/components/kosztorys/summary/tables/materials-breakdown-table'
import { MaterialsTransactionsTable } from '@/components/kosztorys/summary/tables/materials-transactions-table'
import { InlineModeSelect } from '@/components/ui/inline-mode-select'
import {
  PRICING_MODE_DESCRIPTIONS,
  PRICING_MODE_OPTIONS,
} from '@/components/kosztorys/summary/materials-pricing-options'
import { materialsNetRateForMode, pricingModeOf } from '@/lib/kosztorys/materials-pricing-mode'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DecimalField } from '@/components/ui/decimal-field'
import { SlicePie } from '@/components/ui/slice-pie'
import { expensePieSlices } from '@/lib/kosztorys/chart-slices'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { formatNet, ratePercent } from '@/lib/kosztorys/format'
import type { MaterialsT } from '@/lib/kosztorys/summary-economics'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'
import type { MaterialTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  // Names the transactions list's downloaded invoice archive.
  investmentName: string
  // Materiały in two buckets — a zero total hides the breakdown.
  materials: MaterialsT
  materialsBreakdown: MaterialsBreakdownRowT[]
  // Material the company bought and folded into robocizna, split per category. Owner-plane: it lowers
  // marża and never touches the investor's bilans, hence its own table rather than extra rows above
  // „Razem". Absent on a host that doesn't compute it (the editor).
  settledBreakdown?: MaterialsBreakdownRowT[]
  materialTransactions: MaterialTransactionRowT[]
  // The netto rate already gated by the settlement mode (fraction). null = materiały settle brutto,
  // and the split collapses to the single „Kwota" column.
  materialsNetRate: number | null
  // Not displayed — it is the rate the inline control seeds when the owner switches to netto.
  vatRate: number
  // Supplying the writer is what turns the inline control on — same gate as the popover's.
  onMaterialsNetRateChange?: (rate: number | null) => void
  isSavingSettings?: boolean
  // Set by the panel when tryb brutto makes the choice inert — passed through to the inline control.
  pricingLockedReason?: string
  // Read-only client render — no row links on the transactions list.
  preview?: boolean
  // Off on a host that already lists every materiały transaction next to the panel (the investment
  // page's transfers table), where the in-panel list would only repeat it.
  showTransactions?: boolean
  showPie?: boolean
}

export function SummaryExpensesTab({
  investmentId,
  investmentName,
  materials,
  materialsBreakdown,
  settledBreakdown = [],
  materialTransactions,
  materialsNetRate,
  vatRate,
  onMaterialsNetRateChange,
  isSavingSettings = false,
  pricingLockedReason,
  preview = false,
  showTransactions = true,
  showPie = true,
}: PropsT) {
  const pricingMode = pricingModeOf(materialsNetRate)

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Above the row, not inside its left column: nested there it pushed the breakdown table down
          while the pie stayed put, and the tab lost its top edge. */}
      {onMaterialsNetRateChange && (
        <div className="flex flex-col items-start gap-2">
          <InlineModeSelect
            label="Sposób rozliczenia materiałów"
            value={pricingMode}
            onValueChange={(next) =>
              onMaterialsNetRateChange(materialsNetRateForMode(next, vatRate))
            }
            options={PRICING_MODE_OPTIONS}
            description={PRICING_MODE_DESCRIPTIONS[pricingMode]}
            disabled={isSavingSettings}
            lockedReason={pricingLockedReason}
          />
          {pricingMode === 'net' && (
            <DecimalField
              label="Stawka vat na materiały"
              suffix="%"
              withSave
              value={ratePercent(materialsNetRate ?? vatRate)}
              disabled={isSavingSettings}
              // Clamped to the range the action's schema accepts, so a fat-fingered 230 lands on
              // 100% instead of bouncing back as a validation toast.
              onCommit={(percent) =>
                onMaterialsNetRateChange(Math.min(Math.max(percent, 0), 100) / 100)
              }
            />
          )}
        </div>
      )}
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex flex-col gap-6">
          {materials.grossBase + materials.netBilled !== 0 && (
            <MaterialsBreakdownTable rows={materialsBreakdown} netRate={materialsNetRate} />
          )}
          {/* Never rows inside the wydatki table: this spend is the company's, so it must be
              impossible to read as part of „Razem" or of the pie's shares. Its own gate too — an
              investment can have settled material and no investor wydatki at all. */}
          {settledBreakdown.length > 0 && (
            <MaterialsBreakdownTable
              rows={settledBreakdown}
              caption={SETTLED_TYPE.label}
              // Settled material is never billed to the investor, so the netto reduction has
              // nothing to reduce here — brutto-only split.
              netRate={null}
            />
          )}
        </div>
        {showPie && (
          <SlicePie
            slices={expensePieSlices(materialsBreakdown, materialsNetRate)}
            formatValue={formatNet}
          />
        )}
      </div>
      {showTransactions && materialTransactions.length > 0 && (
        <CollapsibleSection title="Lista wydatków" size="sm" defaultOpen={false}>
          <div className="pt-4">
            <MaterialsTransactionsTable
              investmentId={investmentId}
              investmentName={investmentName}
              rows={materialTransactions}
              preview={preview}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
