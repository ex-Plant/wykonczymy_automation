'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { SheetIcon } from 'lucide-react'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { KosztorysTotalsPanel } from '@/components/kosztorys/summary/kosztorys-totals-panel'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useUndoKeyboard } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'
import { useSheetImport } from '@/components/kosztorys/editor/hooks/use-sheet-import'
import { SheetImportDialog } from '@/components/kosztorys/editor/dialogs/sheet-import-dialog'
import { sectionFooterLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-footer-cell'
import { withSyntheticRows } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { ordinalGutterColumn } from '@/components/kosztorys/editor/grid/ordinal-gutter-column'
import { buildSectionBandRows } from '@/lib/kosztorys/section-band-rows'
import { engagedConditionsOfKind, listLabels } from '@/lib/kosztorys/row-conditions'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  makeSpacerRow,
  makeTotalsRow,
} from '@/lib/kosztorys/synthetic-rows'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import {
  NOOP_UNDO_REDO,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'

const ITEM_ROW_HEIGHT = 32
const SECTION_BAND_ROW_HEIGHT = 52

type PropsT = KosztorysEditorDataT & {
  // Read-only public/preview render: hides the mutation chrome, swaps the toolbar for a slim header,
  // kills persistence, and gates the footer's owner-only bits. The owner path leaves it unset.
  preview?: boolean
  // Optional because the read-only client body omits it and falls back to NOOP_UNDO_REDO.
  undoRedo?: UndoRedoApiT
  onOpenVersions?: () => void
  onTreeReplaced?: () => void
}

// The stateful editor: seeds the grid from `tree` at mount (useKosztorysEditor's useState
// initializer). Remounting it (fresh `key` from the wrapper) is how a restore re-seeds the whole
// grid — see KosztorysEditorV2.
export function KosztorysEditorBody({
  investmentId,
  tree,
  investmentName,
  laborCostsNetFromTransactions,
  investmentRabat,
  depositTransactions,
  preview = false,
  undoRedo = NOOP_UNDO_REDO,
  onOpenVersions,
  onTreeReplaced,
  workers,
  ...panelData
}: PropsT) {
  const editor = useKosztorysEditor({ investmentId, tree, preview, undoRedo, workers })
  const {
    gridRef,
    gridHeight,
    columns,
    viewRows,
    guideX,
    subtotals,
    progressSubtotals,
    columnTotals,
    sectionColumnTotals,
    stageTotals,
    stages,
    totalNet,
    sumaPracNet,
    rabatClientNet,
    laborCostsNet,
    subcontractorDue,
    sort,
    search,
    engagedConditionIds,
    resetFilters,
    ordinalByRowId,
    sectionRows,
    setSearch,
    collapsedSectionIds,
    toggleSectionCollapsed,
    onRenameSection,
    onChange,
  } = editor

  useUndoKeyboard(editor.undo, editor.redo)

  const { openImport, importDialogProps } = useSheetImport({ investmentId, onTreeReplaced })

  // Both figures come off the full-dataset `subtotals`, so a search filter narrows the visible rows
  // without changing what the section says it holds or what it is worth.
  const sectionHeader = useMemo(
    () => ({
      figures: new Map(
        subtotals.map((section) => [
          section.sectionId,
          { itemCount: section.itemCount, net: section.net },
        ]),
      ),
      collapsedSectionIds,
      onToggleCollapsed: toggleSectionCollapsed,
      onRename: onRenameSection,
    }),
    [subtotals, collapsedSectionIds, toggleSectionCollapsed, onRenameSection],
  )

  const sectionFooter = useMemo(
    () => ({
      figures: sectionColumnTotals,
      labelColumnId: sectionFooterLabelColumnId(columns.map((column) => column.id)),
    }),
    [sectionColumnTotals, columns],
  )

  const gridColumns = useMemo(
    () =>
      columns.map((column) =>
        withSyntheticRows(column, {
          totals: columnTotals,
          sectionHeader,
          sectionFooter,
        }),
      ),
    [columns, columnTotals, sectionHeader, sectionFooter],
  )
  const bodyRows = useMemo(
    () =>
      buildSectionBandRows(viewRows, {
        collapsedSectionIds,
        enabled: sort == null,
        foldSuppressed: search.trim() !== '',
        sections: sectionRows,
      }),
    [viewRows, collapsedSectionIds, sort, search, sectionRows],
  )
  const gridRows = useMemo(() => [...bodyRows, makeSpacerRow(), makeTotalsRow()], [bodyRows])
  // The empty grid names what emptied it — and the two kinds empty it for opposite reasons: an
  // unticked filter leaves nothing because EVERY pozycja fell into what was unticked, a diagnostic
  // because NONE matched it, which is the goal state and worth saying out loud rather than a dead end.
  const engagedDiagnostics = engagedConditionsOfKind(engagedConditionIds, 'diagnostic')
  const emptyByFilter = engagedConditionsOfKind(engagedConditionIds, 'filter').length > 0
  const gutterColumn = useMemo(() => ordinalGutterColumn(ordinalByRowId), [ordinalByRowId])

  // Reconciliation verdict for the Podsumowanie scream: kosztorys client-view nets (sumaPracNet /
  // rabatClientNet, view-independent) vs the investment's transaction sums — net to net, since the
  // ledger carries no VAT. Built via the shared lib fn — the same one the investment page calls — so
  // the two surfaces can't disagree.
  const reconciliation = useMemo(
    () =>
      buildKosztorysReconciliation({
        sumaPracNet,
        rabatClientNet,
        laborCostsNetFromTransactions,
        investmentRabat,
      }),
    [sumaPracNet, rabatClientNet, laborCostsNetFromTransactions, investmentRabat],
  )

  // Viewport minus the shell's chrome: the h-14 TopNav always, plus the h-14 AppFooter, which only
  // renders below `lg` (hence the two calcs — subtracting it at every width would leave a dead band
  // where no footer exists). The client view mounts under the bare (share) layout, which has neither,
  // so subtracting there is what WOULD leave the dead band — it takes the whole viewport.
  return (
    <KosztorysEditorProvider
      editor={{
        ...editor,
        investmentId,
        investmentName,
        tree,
        onOpenVersions,
        onTreeReplaced,
        openImport: preview ? undefined : openImport,
      }}
    >
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden',
          preview ? 'h-dvh' : 'h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)]',
        )}
      >
        {preview ? (
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <h1 className="truncate text-base font-medium">{investmentName}</h1>
            <div className="flex shrink-0 items-center gap-2">
              {/* The panel's open state is persisted per person, not per view, so without this the
                  client view inherits whatever the toolbar last left and can never fold it back. */}
              <KosztorysTotalsPanelToggle size="default" />
            </div>
          </header>
        ) : (
          <KosztorysEditorToolbar />
        )}
        {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
            needs px for virtualization; without it, it renders all 1000 rows.
            The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
            stretch the container to the sum of the columns, it scrolls them internally instead. */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* min-w-0 lets the wrapper shrink below its content in a flex context;
              grid-cols-1 still gives the grid a definite width (anti-flicker). */}
          <div ref={gridRef} className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden">
            <DynamicDataSheetGrid
              className="kosztorys-grid"
              value={gridRows}
              // Strip the appended spacer + „Razem" rows before the editor's diff sees them — display-only.
              onChange={(rows) => onChange(rows.filter((row) => !isSyntheticRow(row.id)))}
              columns={gridColumns}
              gutterColumn={gutterColumn}
              height={gridHeight}
              rowHeight={({ rowData }) =>
                isSectionHeaderRow(rowData.id) ? SECTION_BAND_ROW_HEIGHT : ITEM_ROW_HEIGHT
              }
              // Taller header so verbose column labels („Pozostało netto (względem przedmiaru)" etc.)
              // wrap onto two rows instead of truncating.
              headerRowHeight={56}
              lockRows
              rowKey={({ rowData }) => String(rowData.id)}
              rowClassName={({ rowData }) =>
                cn(
                  sectionColorRail(rowData.sectionColor),
                  isSectionHeaderRow(rowData.id) && 'kosztorys-section-header',
                  isSectionFooterRow(rowData.id) && 'kosztorys-section-footer',
                )
              }
            />
          </div>
          {/* Emptiness is judged on `subtotals` (full-dataset) rather than the rendered rows:
              `gridRows` always carries the spacer + „Razem" rows, and a no-hit search empties
              `viewRows` over a kosztorys that is not in fact empty. */}
          {subtotals.length === 0 && (
            <EmptyState
              className="pointer-events-none absolute inset-0"
              title="Kosztorys jest pusty"
              // The client view renders no toolbar, so it has no „Dodaj" menu to point at.
              description={preview ? undefined : 'Dodaj sekcję lub etap z menu „Dodaj" powyżej.'}
            >
              {/* Typing a rozpiska by hand is the rarer of the two starts — the sheet already holds
                  it. Buried in „Opcje" it is the one moment nobody finds it. */}
              {!preview && (
                <Button
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto"
                  onClick={openImport}
                >
                  <SheetIcon />
                  Pobierz z arkusza Google…
                </Button>
              )}
            </EmptyState>
          )}
          {/* The sibling state: rows exist, the search matched none of them. Gated on the search term
              rather than on `viewRows` alone so the „Wyczyść" advice can never be offered to someone
              who never typed anything. Unreachable in the client view, which renders no search field. */}
          {subtotals.length > 0 && viewRows.length === 0 && search.trim() !== '' && (
            <EmptyState
              className="pointer-events-none absolute inset-0"
              title="Brak wyników"
              description={`Żadna pozycja nie pasuje do „${search.trim()}".`}
            >
              {/* The overlay is click-through so the grid stays usable; the button opts back in. */}
              <Button
                variant="outline"
                size="sm"
                className="pointer-events-auto"
                onClick={() => setSearch('')}
              >
                Wyczyść wyszukiwanie
              </Button>
            </EmptyState>
          )}
          {/* A filter emptying itself is the goal state, not a dead end — nothing is left in the
              state it was looking for, so say that rather than leave a blank grid. Search takes
              precedence above: with both on, „nie pasuje do…" is the more specific explanation. */}
          {/* Gated on the RECOGNISED conditions, not on the raw persisted set: an id left over from a
              condition a later release removed is a no-op for the grid, and counting it here would
              title the overlay „Brak pozycji " with nothing after it. */}
          {subtotals.length > 0 &&
            viewRows.length === 0 &&
            search.trim() === '' &&
            (emptyByFilter || engagedDiagnostics.length > 0) && (
              <EmptyState
                className="pointer-events-none absolute inset-0"
                title={
                  emptyByFilter
                    ? 'Wszystkie pozycje schowane'
                    : `Brak pozycji ${listLabels(engagedDiagnostics, 'ani')}`
                }
                description={
                  emptyByFilter ? undefined : 'Filtr zrobił swoje — nie ma już czego poprawiać.'
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto"
                  onClick={resetFilters}
                >
                  Zresetuj filtry
                </Button>
              </EmptyState>
            )}
          {/* Overlays the grid's bottom edge instead of consuming a flex track — the grid keeps its
              full height and its last rows scroll under the (opaque) panel rather than being pushed up. */}
          <KosztorysTotalsPanel
            {...panelData}
            investmentId={investmentId}
            investmentName={investmentName}
            depositTransactions={depositTransactions}
            stages={stages}
            stageTotals={stageTotals}
            workers={workers}
            subcontractorDue={subcontractorDue}
            totalNet={totalNet}
            laborCostsNet={laborCostsNet}
            sectionSubtotals={progressSubtotals}
            rabatAmount={rabatClientNet}
            reconciliation={reconciliation}
            vatRate={tree.vatRate}
            settlementMode={tree.settlementMode}
            onSettlementModeChange={editor.handleSettlementModeChange}
            materialsNetRate={tree.materialsNetRate}
            onMaterialsNetRateChange={editor.handleMaterialsNetRateChange}
            isSavingSettings={editor.isSavingSettings}
            showSettingsBar
            preview={preview}
          />
        </div>
        {/* Vertical guide while dragging a column edge (left = cursor viewport X). Portaled to body:
            <main> uses transform-gpu, which would otherwise make this `fixed` element measure `left`
            from <main> (sidebar-offset) instead of the viewport — same containing-block trap as the
            context menu. */}
        {guideX !== null &&
          createPortal(
            <div
              className="bg-primary/70 pointer-events-none fixed inset-y-0 z-50 w-px"
              style={{ left: guideX }}
            />,
            document.body,
          )}
        {/* One instance for both triggers — the „Opcje" menu and the empty-kosztorys screen. */}
        {!preview && <SheetImportDialog {...importDialogProps} />}
      </div>
    </KosztorysEditorProvider>
  )
}
