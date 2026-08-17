import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { FieldChangeT, StageChangeT } from '@/lib/kosztorys/undo-coalesce'
import { diffRow } from '@/lib/kosztorys/v2-rows'
import type { ItemPatchT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// What one grid onChange batch means, decided without touching React: which fields and which stage
// cells actually changed, and which rows the editor must carry forward. The hook keeps the
// imperative half — firing the saves, merging into `rows`, arming the coalesce timer.

// A field change plus the value the write sends. `after` is the row's value and `value` the diffed
// patch's — the same thing today, but the write and the undo entry ask different questions of it, so
// the plan answers both rather than making the caller assume they stay equal.
export type PlannedFieldChangeT = FieldChangeT & { value: ItemPatchT[keyof ItemPatchT] }

export type GridChangePlanT = {
  fieldChanges: PlannedFieldChangeT[]
  stageChanges: StageChangeT[]
  // Rows with at least one change — merged into the full dataset by id, so a filter or sort can't
  // lose the rows the view didn't render.
  changedRows: KosztorysV2RowT[]
  // Every row the diff could read, changed or not: the snapshot advances for all of them, exactly as
  // the pre-extraction loop did.
  seenRows: KosztorysV2RowT[]
}

// A row absent from `prevById` is skipped entirely: with no snapshot there is nothing to diff
// against, and treating it as all-new would fire a write per field of a row the editor has never
// seen.
export function planGridChanges(
  next: readonly KosztorysV2RowT[],
  prevById: ReadonlyMap<number, KosztorysV2RowT>,
): GridChangePlanT {
  const plan: GridChangePlanT = {
    fieldChanges: [],
    stageChanges: [],
    changedRows: [],
    seenRows: [],
  }
  for (const row of next) {
    const prev = prevById.get(row.id)
    if (!prev) continue
    const diff = diffRow(prev, row)
    if (diff.itemPatch) {
      const patch = diff.itemPatch
      for (const field of Object.keys(patch) as (keyof ItemPatchT)[]) {
        plan.fieldChanges.push({
          id: row.id,
          field,
          before: prev[field as keyof KosztorysV2RowT],
          after: row[field as keyof KosztorysV2RowT],
          value: patch[field],
        })
      }
    }
    for (const sc of diff.stageChanges ?? []) {
      plan.stageChanges.push({
        id: row.id,
        stageId: sc.stageId,
        before: Number(prev[stageKey(sc.stageId)]) || 0,
        after: sc.qty,
      })
    }
    if (diff.itemPatch || diff.stageChanges) plan.changedRows.push(row)
    plan.seenRows.push(row)
  }
  return plan
}
