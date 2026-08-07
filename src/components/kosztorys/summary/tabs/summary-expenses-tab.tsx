'use client'

import { MaterialsBreakdownTable } from '@/components/kosztorys/summary/tables/materials-breakdown-table'
import { MaterialsTransactionsTable } from '@/components/kosztorys/summary/tables/materials-transactions-table'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SlicePie } from '@/components/ui/slice-pie'
import { expensePieSlices } from '@/lib/kosztorys/chart-slices'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { formatNet } from '@/lib/kosztorys/format'
import type { MaterialsT } from '@/lib/kosztorys/summary-economics'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { MaterialTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  // Names the transactions list's downloaded invoice archive.
  investmentName: string
  // Materiały in two buckets — a zero total hides the breakdown.
  materials: MaterialsT
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Material the company bought and folded into robocizna, split per category. Owner-plane: it lowers
  // marża and never touches the investor's bilans, hence its own table rather than extra rows above
  // „Razem". Absent on a host that doesn't compute it (the editor).
  settledBreakdown?: MaterialyBreakdownRowT[]
  materialTransactions: MaterialTransactionRowT[]
  // The netto rate already gated by the settlement mode (fraction) — read-only here; the control that
  // writes it lives in the panel's settlement bar. null = no rate governs, and the Netto column falls
  // back to `vatRate`.
  materialsNetRate: number | null
  // Fallback for the Netto column when no materiały rate is set.
  vatRate: number
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
  materialyBreakdown,
  settledBreakdown = [],
  materialTransactions,
  materialsNetRate,
  vatRate,
  preview = false,
  showTransactions = true,
  showPie = true,
}: PropsT) {
  // Presentation only: the column stands even where no rate governs and marża/bilans still run on the
  // brutto receipts. Hence the VAT fallback — „ile to kosztowało bez VAT-u" is answerable on every
  // investment, in every tryb rozliczenia. At rozliczenie brutto the incoming rate is null by design,
  // so the column reads the VAT that actually prices the deal rather than an inert saved concession.
  const displayNetRate = materialsNetRate ?? vatRate

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex flex-col gap-6">
          {materials.grossBase + materials.netBilled !== 0 && (
            <MaterialsBreakdownTable rows={materialyBreakdown} netRate={displayNetRate} />
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
            slices={expensePieSlices(materialyBreakdown, displayNetRate)}
            formatValue={formatNet}
          />
        )}
      </div>
      {showTransactions && materialTransactions.length > 0 && (
        <CollapsibleSection title="Lista wydatków" size="sm">
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
