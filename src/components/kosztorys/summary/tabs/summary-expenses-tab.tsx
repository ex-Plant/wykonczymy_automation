'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { DecimalField } from '@/components/ui/decimal-field'
import { MaterialsBreakdownTable } from '@/components/kosztorys/summary/tables/materials-breakdown-table'
import { MaterialsTransactionsTable } from '@/components/kosztorys/summary/tables/materials-transactions-table'
import { SlicePie } from '@/components/ui/slice-pie'
import { expensePieSlices } from '@/lib/kosztorys/chart-slices'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { formatNet } from '@/lib/kosztorys/format'
import { materialsNetDiscount, type MaterialsT } from '@/lib/kosztorys/summary-economics'
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
  // Material the company bought and folded into robocizna, split per category. Owner-plane: it lowers
  // marża and never touches the investor's bilans, hence its own table rather than extra rows above
  // „Razem". Absent on a host that doesn't compute it (the editor).
  settledBreakdown?: MaterialyBreakdownRowT[]
  materialTransactions: MaterialTransactionRowT[]
  // Netto column is on show (axis ≠ Brutto) — gates the reduction split inside the table.
  nettoShown: boolean
  // Opening value when the owner switches the concession on: billing materiały netto at the VAT rate
  // is the case this feature was built for, so it is one click rather than a number to look up.
  vatRate: number
  // The investment's saved netto rate (fraction) and its writer — persisted, not browser-local.
  materialsNetRate: number | null
  onMaterialsNetRateChange: (rate: number | null) => void
  // Brutto-settled investment: the saved rate changes nothing. Shows a notice instead of silently
  // pricing at brutto while the control reads 23%.
  inertOnBruttoSettlement?: boolean
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
  settledBreakdown = [],
  materialTransactions,
  nettoShown,
  vatRate,
  materialsNetRate,
  onMaterialsNetRateChange,
  inertOnBruttoSettlement = false,
  clientView = false,
  showTransactions = true,
  showPie = true,
}: PropsT) {
  const netPricingOn = materialsNetRate != null
  const materialsNetPercent = Math.round((materialsNetRate ?? vatRate) * 100)
  const discountAmount = materialsNetDiscount(materials.grossBase, materialsNetRate)
  // The pricing controls are owner-only; the table's `showReduction` is not, so a client still sees
  // the reduced figures the owner's setting produces — just not the switch that produced them.
  // Offered on a brutto-settled investment too, alongside the notice: hiding the control there would
  // leave a saved rate with no way to see or clear it.
  const showPricingControls = !clientView

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        {/* One tables column, pie beside it. The netto-pricing controls live in here too so they sit
            directly under the table they drive — as a sibling of the row they'd be pushed below the
            taller pie column. */}
        <div className="flex flex-col gap-6">
          {materials.grossBase + materials.netBilled !== 0 && (
            <div className="flex flex-col gap-2">
              <MaterialsBreakdownTable
                rows={materialyBreakdown}
                netRate={materialsNetRate}
                showReduction={nettoShown && netPricingOn}
              />
              {showPricingControls && (
                <label
                  className={cn(
                    // Padded past the 16px checkbox so the whole caption is a comfortable hit target
                    // rather than a hairline row you have to aim at; the negative margin keeps the
                    // text aligned with the table above while the hover surface extends past it.
                    'hover:bg-accent -mx-2 flex w-fit cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs transition-colors',
                    netPricingOn ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <Checkbox
                    checked={netPricingOn}
                    // Switching off clears the rate rather than storing 0: „nigdy nie ustawiono" is
                    // the state that leaves marża exactly where it was.
                    onCheckedChange={(value) =>
                      onMaterialsNetRateChange(value === true ? vatRate : null)
                    }
                  />
                  Zaznacz jeśli wydatki mają być rozliczane po kwocie netto
                </label>
              )}
              {showPricingControls && netPricingOn && (
                <>
                  <span className="text-muted-foreground text-xs">Stawka netto wydatków</span>
                  <div className="flex items-center gap-2">
                    <DecimalField
                      label=""
                      value={materialsNetPercent}
                      onCommit={(percent) => onMaterialsNetRateChange(percent / 100)}
                    />
                    <span className="text-muted-foreground text-xs">
                      % (−{formatNet(discountAmount)} zł)
                    </span>
                  </div>
                  {inertOnBruttoSettlement && (
                    <span className="text-muted-foreground text-xs">
                      Przy rozliczeniu brutto VAT jest doliczany do ceny, więc ta stawka nic nie
                      zmienia — ani w kwotach, ani w marży.
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          {/* Never rows inside the wydatki table: this spend is the company's, so it must be
              impossible to read as part of „Razem" or of the pie's shares. Its own gate too — an
              investment can have settled material and no investor wydatki at all. */}
          {settledBreakdown.length > 0 && (
            <div className="flex flex-col gap-1">
              <MaterialsBreakdownTable
                rows={settledBreakdown}
                caption={SETTLED_TYPE.label}
                // Settled material is never billed to the investor, so the netto reduction has
                // nothing to reduce here — brutto-only split.
                netRate={null}
              />
              <span className="text-muted-foreground text-xs">
                Obniżają marżę, nie wchodzą do bilansu inwestora.
              </span>
            </div>
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
