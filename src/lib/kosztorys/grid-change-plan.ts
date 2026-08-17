import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { FieldChangeT, StageChangeT } from '@/lib/kosztorys/undo-coalesce'
import { diffRow } from '@/lib/kosztorys/v2-rows'
import type { ItemPatchT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// What one grid onChange batch means, decided without touching React: which fields and which stage
// cells actually changed, and which rows the editor must carry forward. The hook keeps the
// imperative half — firing the saves, merging into `rows`, arming the coalesce timer.

export type GridChangePlanT = {
  fieldChanges: FieldChangeT[]
  stageChanges: StageChangeT[]
  // Rows with at least one change, keyed by id — merged into the full dataset by id, so a filter or
  // sort can't lose the rows the view didn't render.
  //
  // Deliberately NOT a list of every row the diff read: `next` is the whole visible grid, so
  // returning that would allocate a 1000-element array per keystroke for a snapshot advance the
  // caller can do by walking the array it already holds.
  changedById: Map<number, KosztorysV2RowT>
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
    changedById: new Map(),
  }
  for (const row of next) {
    const prev = prevById.get(row.id)
    if (!prev) continue
    const diff = diffRow(prev, row)
    if (diff.itemPatch) {
      // `after` IS the value the write sends: diffRow builds the patch as `patch[f] = next[f]`, so a
      // separate patch-value field would only be a second copy of the same read.
      for (const field of Object.keys(diff.itemPatch) as (keyof ItemPatchT)[]) {
        plan.fieldChanges.push({
          id: row.id,
          field,
          before: prev[field as keyof KosztorysV2RowT],
          after: row[field as keyof KosztorysV2RowT],
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
    if (diff.itemPatch || diff.stageChanges) plan.changedById.set(row.id, row)
  }
  return plan
}
