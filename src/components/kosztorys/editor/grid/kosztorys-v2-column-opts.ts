import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { ProgressDisplayT } from '@/lib/kosztorys/progress-display'
import type { ItemRemovalPlanT } from '@/lib/kosztorys/delete-policy'
import type { SortDirT, SortScopeT } from '@/lib/kosztorys/row-view'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysStageT, KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

// The scope rides inside the sort rather than as a separate editor toggle, so clearing the sort
// cannot leave a stale scope behind.
export type SortPickT = { dir: SortDirT; scope: SortScopeT }
export type V2SortStateT = ({ field: string } & SortPickT) | null

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  // Stages (etapy) render as dynamic editable columns; a trailing "Pozostało" reads out the
  // remaining net.
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  onSetStagePlane?: (stageId: number, plane: ToolPlaneT) => void
  workers?: WorkerRefT[]
  onSetStageWorker?: (stageId: number, workerId: number | null) => void
  // Only so the reassignment confirm can quote the amount being moved.
  executedValueByStage?: Map<number, number>
  sort?: V2SortStateT
  onSetSort?: (field: string, pick: SortPickT | null) => void
  // Column picker: true = this column is off — by the user's stored choice OR by
  // DEFAULT_HIDDEN_COLUMNS, which the caller resolves; the two are indistinguishable here. Keyed by
  // column id, except stage columns, which answer to one of the three stage groups (constants.ts).
  isHidden?: (id: string) => boolean
  // Money axis: narrows the picker's answer further, never widens it. Omitted = 'both' = every
  // column the picker allows, which is what buildV2ToggleItems (axis-blind by design) assumes.
  moneyAxis?: MoneyAxisT
  // Progress display: narrows the same way the money axis does, on the other axis — a stage's
  // progress reads either as money or as a percentage, never as both at once.
  progressDisplay?: ProgressDisplayT
  // Layer: narrows to the working columns or the progress tracker. Omitted = 'both' = no narrowing.
  layer?: LayerT
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  // Row actions: removing an item + reading a section's item count (to enforce the
  // "≥1 item" invariant).
  onRemoveItem?: (row: KosztorysV2RowT) => void
  // What deleting this row does: a hard block (disabled + tooltip reason) for the empty-sheet floor,
  // or a removable plan carrying whether a populated-row confirm is required first.
  getRemovePlan?: (row: KosztorysV2RowT) => ItemRemovalPlanT
  // Reordering items within a section (Przesuń w górę/dół). Greyed out while a column sort is
  // active — "up/down" has no meaning against a price-sorted list.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  onInsertItem?: (row: KosztorysV2RowT, dir: 'above' | 'below') => void
  // Renaming the whole section from its (denormalized) name cell. Routes through the same fan-out
  // as the section panel — never a per-row setRowData, which would desync the other rows' copies.
  onRenameSection?: (sectionId: number, name: string) => void
  // Deleting the whole section a row belongs to, from the row-actions menu. Cascade-deletes the
  // section's items + stage_progress (same path as the section panel), guarded by a confirm dialog.
  onRemoveSection?: (sectionId: number) => void
  // Moving the whole section one place (Przesuń w górę/dół, „Sekcja" group) from the row-actions
  // menu. Greyed out under an active column sort, for the same reason as the per-item ▲▼.
  onReorderSection?: (sectionId: number, dir: 'up' | 'down') => void
  onInsertSection?: (sectionId: number, dir: 'above' | 'below') => void
  // „Zapisz kolejność": writes the active sort into display_order across every section, so the order
  // survives clearing the sort. Lives in the column header menu, next to the sort it bakes — there is
  // no per-section sort to bake, so there is no per-section variant either. Silent no-op without a
  // sort — there is nothing to write then.
  onPersistKosztorysOrder?: () => void
  // Pinning the section to a palette colour (null clears it) — the colour the Podsumowanie pie uses
  // for this section's wycinek.
  onSetSectionColor?: (sectionId: number, color: SectionColorKeyT | null) => void
  // „Etapy są prawdą": drops the sheet's imported pomiar from this pozycja, which takes it off the
  // rozjazd list. Behind the same `editorOnly()` gate as every other row action.
  onClearSheetMeasuredQty?: (row: KosztorysV2RowT) => void
  // Item count for a section, to size the "removes N items" confirm before deleting it.
  getSectionItemCount?: (sectionId: number) => number
  // Global discount active → the four per-item discount columns are overridden, so drop them from
  // the grid and the picker (the underlying data stays and returns when the discount is cleared).
  globalDiscountActive?: boolean
  // Lock the whole grid: every data cell becomes `disabled` and the row-actions column is dropped.
  // Omitting the mutation callbacks is NOT enough — a cell with no callback still takes focus and
  // enters edit mode, so a client-facing grid would look editable and swallow keystrokes.
  readOnly?: boolean
  // The client's document: exactly PREVIEW_VISIBLE_COLUMNS, and it OVERRIDES every option above that
  // describes one owner's reading preferences (isHidden / moneyAxis / progressDisplay / layer), since
  // none of those may shape what a client is served. `globalDiscountActive` still applies — it is the
  // investment's own state, not a preference; selectV2Columns spells the split out.
  // Orthogonal to `readOnly`: read-only is about interaction, this is about disclosure. NOT orthogonal
  // to `view`, which must be 'client' whenever this is set — selectV2Columns throws on the mismatch,
  // and `assertDisclosurePair` says why.
  previewVisible?: boolean
}
