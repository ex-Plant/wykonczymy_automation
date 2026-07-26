'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import {
  computeSubcontractorSummary,
  UNASSIGNED_WORKER_NAME,
} from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/settlement'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { PlaneUnconfirmedBadge } from '@/components/ui/plane-unconfirmed-badge'
import { KosztorysGlobalSettings } from '@/components/kosztorys/editor/toolbar/kosztorys-global-settings'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/reference-data'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  investmentId: number
  // View-independent settlement: each etap valued at its OWN plane's price. `combined` is „Suma
  // wykonanej pracy"; `wTools`/`ownTools` feed the split rows; `hasUnconfirmedPlane` flips the badge.
  subcontractorDue: SubcontractorDueByPlaneT
  // Realized PAYOUTs per worker (null-worker bucket kept), name-enriched at the page.
  payouts: SubcontractorPayoutRowT[]
  // The un-summed PAYOUT rows, already date-desc from the query. Feed the sortable/virtualized list.
  payoutTransactions: PayoutTransactionRowT[]
  // Off on a host outside KosztorysEditorProvider (the investment page) — the coefficient controls
  // read the editor context, which only exists inside the editor.
  showGlobalSettings?: boolean
  // Off on a host that already lists every transaction next to the panel (the investment page's
  // transfers table): only the headline + per-worker totals remain.
  showTransactions?: boolean
}

type GroupModeT = 'worker' | 'date'

const MODE_OPTIONS: OptionT<GroupModeT>[] = [
  { value: 'worker', label: 'Wg pracownika' },
  { value: 'date', label: 'Wg daty' },
]

const UNASSIGNED_KEY = 'unassigned'
const workerKey = (workerId: number | null) => (workerId === null ? UNASSIGNED_KEY : workerId)

// One flat row per wypłata for the virtualized DataTable — worker name resolved up front so the
// grid can sort on it without a per-cell lookup.
type PayoutTableRowT = {
  workerId: number | null
  workerName: string
  date: string
  amount: number
  description: string | null
}

// Fixed height for the virtualizer's scroll container (it needs px, not a flex track). Kept short
// enough that the headline + totals block above it stay visible inside the collapsible panel.
const TABLE_HEIGHT = 400
const ROW_HEIGHT = 36

const PAYOUT_COLUMNS: ColumnDef<PayoutTableRowT>[] = [
  {
    accessorKey: 'date',
    header: 'Data',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatPLDate(getValue<string>())}</span>
    ),
  },
  { accessorKey: 'workerName', header: 'Pracownik' },
  {
    accessorKey: 'description',
    header: 'Opis',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() || '—'}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Kwota',
    meta: { align: 'right' },
    cell: ({ getValue }) => (
      <span className="text-chart-green tabular-nums">{formatNet(getValue<number>())}</span>
    ),
  },
]

// The subcontractor-plane footer, shown in the Z narzędziami / Bez narzędzi views in place of the
// client Podsumowanie. One „Kwota" column throughout, no netto/brutto axis (EX-558: subcontractors
// are paid without VAT). Owner-only by construction — these views are unreachable in the client
// preview, so the per-worker links are always live (no plain-text fallback needed).
export function SubcontractorSummary({
  investmentId,
  subcontractorDue,
  payouts,
  payoutTransactions,
  showGlobalSettings = true,
  showTransactions = true,
}: PropsT) {
  const summary = computeSubcontractorSummary(subcontractorDue.combined, payouts)
  const nameByWorker = new Map(payouts.map((payout) => [workerKey(payout.workerId), payout.name]))
  const [mode, setMode] = useState<GroupModeT>('worker')

  const tableRows: PayoutTableRowT[] = payoutTransactions.map((tx) => ({
    workerId: tx.workerId,
    workerName: nameByWorker.get(workerKey(tx.workerId)) ?? UNASSIGNED_WORKER_NAME,
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
  }))

  // The toggle is a sort preset — „Wg pracownika" groups by name, „Wg daty" is reverse-chronological.
  // Keying the DataTable on `mode` resets its internal sort to this preset; column-header clicks then
  // refine within the chosen mode.
  const initialSorting =
    mode === 'worker' ? [{ id: 'workerName', desc: false }] : [{ id: 'date', desc: true }]

  return (
    <div className="text-foreground flex w-full flex-col gap-y-4 px-4 pt-6 pb-10 text-sm">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <HeadlineSummary summary={summary} due={subcontractorDue} />
        {summary.rows.length > 0 && (
          <WorkerTotals investmentId={investmentId} rows={summary.rows} />
        )}
      </div>
      {showGlobalSettings && <EditorGlobalSettings />}

      {showTransactions && payoutTransactions.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <div className="w-fit">
            <ToggleGroup
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              aria-label="Grupowanie wypłat"
            />
          </div>
          <DataTable
            key={mode}
            data={tableRows}
            columns={PAYOUT_COLUMNS}
            enableVirtualization
            virtualRowHeight={ROW_HEIGHT}
            virtualContainerHeight={TABLE_HEIGHT}
            initialSorting={initialSorting}
            getRowHref={(row) =>
              row.workerId === null
                ? undefined
                : investmentTransfersHref(investmentId, {
                    types: ['PAYOUT'],
                    worker: row.workerId,
                  })
            }
            className="w-full max-w-5xl"
          />
        </div>
      )}
    </div>
  )
}

// Split out so the context read happens only where the provider exists — a hook can't be conditional,
// but rendering the component that calls it can.
function EditorGlobalSettings() {
  const { tree, handleGlobalCoeffChange } = useKosztorysEditorContext()
  return (
    <KosztorysGlobalSettings
      globalCoeffs={tree.globalCoeffs}
      onGlobalCoeffChange={handleGlobalCoeffChange}
    />
  )
}

// Explains the badge: an etap with no rozliczenie belongs to neither crew, so it lands in neither
// amount — „Suma wykonanej pracy" UNDERstates the executed work until every etap is assigned.
const UNCONFIRMED_PLANE_HINT =
  'Niektóre etapy nie mają potwierdzonego rozliczenia — nie wchodzą do żadnej z kwot, więc suma jest niższa niż faktycznie wykonana praca.'

function HeadlineSummary({
  summary,
  due,
}: {
  summary: ReturnType<typeof computeSubcontractorSummary>
  due: SubcontractorDueByPlaneT
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
      <SummaryHeaderCell variant="label">Podsumowanie podwykonawców</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {/* Split by plane: each etap valued at its own price, so Z + Bez = razem exactly. Shown even
          when one side is 0, so the reader sees the settlement is plane-aware. */}
      <SummaryLabelCell>{PLANE_LABELS.w_tools}</SummaryLabelCell>
      <SummaryValueCell>{formatNet(due.wTools)}</SummaryValueCell>

      <SummaryLabelCell>{PLANE_LABELS.own_tools}</SummaryLabelCell>
      <SummaryValueCell>{formatNet(due.ownTools)}</SummaryValueCell>

      <SummaryLabelCell className="flex items-center gap-x-2 font-bold">
        Suma wykonanej pracy
        {due.hasUnconfirmedPlane && (
          <PlaneUnconfirmedBadge content={UNCONFIRMED_PLANE_HINT} className="size-4" />
        )}
      </SummaryLabelCell>
      <SummaryValueCell className="font-bold">{formatNet(due.combined)}</SummaryValueCell>

      <SummaryLabelCell className="font-medium">Zaliczki (wypłaty) razem</SummaryLabelCell>
      <SummaryValueCell className="text-chart-green font-medium">
        {formatNet(summary.payoutsTotal)}
      </SummaryValueCell>

      {/* Pozostało do wypłaty = należne − zaliczki. Negative = the crew has been overpaid — an
          anomaly, so it reads red; a normal positive „still owed" stays neutral bold. */}
      <SummaryLabelCell className="font-bold">Pozostało do wypłaty</SummaryLabelCell>
      <SummaryValueCell className={cn('font-bold', summary.remaining < 0 && 'text-destructive')}>
        {formatNet(summary.remaining)}
      </SummaryValueCell>
    </SummaryTable>
  )
}

function WorkerTotals({
  investmentId,
  rows,
}: {
  investmentId: number
  rows: ReturnType<typeof computeSubcontractorSummary>['rows']
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="h-fit w-fit">
      <SummaryHeaderCell variant="label">Podsumowanie pracowników</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {rows.map((row) => (
        <div key={workerKey(row.workerId)} className="contents">
          <SummaryLabelCell className="font-medium">
            {row.workerId === null ? (
              row.name
            ) : (
              <Link
                href={investmentTransfersHref(investmentId, {
                  types: ['PAYOUT'],
                  worker: row.workerId,
                })}
                className="hover:underline"
              >
                {row.name}
              </Link>
            )}
          </SummaryLabelCell>
          <SummaryValueCell className="text-chart-green font-medium">
            {formatNet(row.total)}
          </SummaryValueCell>
        </div>
      ))}
    </SummaryTable>
  )
}
