'use client'

import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SubcontractorHeadlineSummary } from '@/components/kosztorys/summary/blocks/subcontractor-headline-summary'
import { SubcontractorWorkerTotals } from '@/components/kosztorys/summary/blocks/subcontractor-worker-totals'
import { SubcontractorPayoutsTable } from '@/components/kosztorys/summary/tables/subcontractor-payouts-table'
import { EditorGlobalSettings } from '@/components/kosztorys/editor/toolbar/editor-global-settings'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  // View-independent settlement: each etap valued at its OWN plane's price. `combined` is „Suma
  // wykonanej pracy"; `wTools`/`ownTools` feed the split rows; `hasUnconfirmedPlane` flips the badge.
  subcontractorDue: SubcontractorDueByPlaneT
  // Realized PAYOUTs per worker (null-worker bucket kept), name-enriched at the page.
  payouts: SubcontractorPayoutRowT[]
  // The un-summed PAYOUT rows, already date-desc from the query. Feed the sortable/virtualized list.
  payoutTransactions: PayoutTransactionRowT[]
  // The etap list and the roster, both only for the per-worker table: stages say who is ASSIGNED
  // (even where nothing is owed yet), workers supply names the payout rows don't carry.
  stages?: KosztorysStageT[]
  workers?: WorkerRefT[]
  // Off on a host outside KosztorysEditorProvider (the investment page) — the coefficient controls
  // read the editor context, which only exists inside the editor.
  showGlobalSettings?: boolean
  // Off on a host that already lists every transaction next to the panel (the investment page's
  // transfers table): only the headline + per-worker totals remain.
  showTransactions?: boolean
  // Off where the tab is a quick readout rather than the settlement workbench (the investment page):
  // drops the per-plane split rows and the per-worker table, leaving the three totals that matter.
  showBreakdown?: boolean
}

// The subcontractor-plane footer, shown in the Z narzędziami / Bez narzędzi views in place of the
// client Podsumowanie.
export function SubcontractorSummary({
  investmentId,
  subcontractorDue,
  payouts,
  payoutTransactions,
  stages,
  workers,
  showGlobalSettings = true,
  showTransactions = true,
  showBreakdown = true,
}: PropsT) {
  const summary = computeSubcontractorSummary(subcontractorDue.combined, payouts, {
    byWorker: subcontractorDue.byWorker,
    stages,
    workers,
  })

  return (
    <div className="text-foreground flex w-full flex-col gap-y-4 px-4 pt-4 pb-4 text-sm">
      {/* The multiplier controls lead the block, like the rozliczenie selects on the other tabs: they
          price every figure below them, so they read as the setting the tables answer to rather than
          a footnote to one of them. Above the row, not inside its left column — nested there they
          pushed the headline table down and the two tables stopped lining up. */}
      {showGlobalSettings && <EditorGlobalSettings />}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        {showBreakdown && summary.rows.length > 0 && (
          <SubcontractorWorkerTotals investmentId={investmentId} rows={summary.rows} />
        )}
        <SubcontractorHeadlineSummary
          summary={summary}
          due={subcontractorDue}
          showPlanes={showBreakdown}
        />
      </div>

      {showTransactions && payoutTransactions.length > 0 && (
        <CollapsibleSection title="Lista wpłat" size="sm" defaultOpen={false}>
          <SubcontractorPayoutsTable
            investmentId={investmentId}
            payouts={payouts}
            payoutTransactions={payoutTransactions}
          />
        </CollapsibleSection>
      )}
    </div>
  )
}
