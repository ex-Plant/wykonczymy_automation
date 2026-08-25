import { itemFieldLane, stageLane } from '@/lib/kosztorys/save-lanes'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { FieldChangeT, StageChangeT } from '@/lib/kosztorys/undo-coalesce'
import type { ItemPatchT } from '@/lib/kosztorys/types'

// How a captured grid-edit batch is played back — undo takes each change's `before`, redo its
// `after`, so one direction flag drives both. The hook keeps the dispatch: applying the patches to
// `rows`/`prevById` and running the writes through their save lanes.

export type ReversalDirT = 'undo' | 'redo'

const pick = <T>(change: { before: T; after: T }, dir: ReversalDirT) =>
  dir === 'undo' ? change.before : change.after

// The value to write back if the inverse write itself fails — the state the grid held before this
// reversal, which is the opposite end of the same change.
const restoreOf = <T>(change: { before: T; after: T }, dir: ReversalDirT) =>
  dir === 'undo' ? change.after : change.before

// One patch per row, so a row edited across several fields and stages applies in a single setRows
// pass instead of once per change.
export function buildReversalPatches(
  fields: readonly FieldChangeT[],
  stages: readonly StageChangeT[],
  dir: ReversalDirT,
): Map<number, Record<string, unknown>> {
  const patchById = new Map<number, Record<string, unknown>>()
  for (const c of fields) {
    const patch = patchById.get(c.id) ?? {}
    patch[c.field as string] = pick(c, dir)
    patchById.set(c.id, patch)
  }
  for (const c of stages) {
    const patch = patchById.get(c.id) ?? {}
    patch[stageKey(c.stageId)] = pick(c, dir)
    patchById.set(c.id, patch)
  }
  return patchById
}

// `lane` is the save lane the inverse write is serialized on. It MUST match the lane the forward
// autosave used for the same cell, or an undo can overtake the save it is undoing (EX-526 #1) — which
// is why both keys are built here rather than spelled out at each call site.
export type ReversalWriteT =
  | {
      kind: 'field'
      lane: string
      id: number
      field: keyof ItemPatchT
      value: unknown
      restore: unknown
    }
  | {
      kind: 'stage'
      lane: string
      id: number
      stageId: number
      value: number
      restore: number
    }

export function planReversalWrites(
  fields: readonly FieldChangeT[],
  stages: readonly StageChangeT[],
  dir: ReversalDirT,
): ReversalWriteT[] {
  return [
    ...fields.map(
      (c): ReversalWriteT => ({
        kind: 'field',
        lane: itemFieldLane(c.id, c.field),
        id: c.id,
        field: c.field,
        value: pick(c, dir),
        restore: restoreOf(c, dir),
      }),
    ),
    ...stages.map(
      (c): ReversalWriteT => ({
        kind: 'stage',
        lane: stageLane(c.id, c.stageId),
        id: c.id,
        stageId: c.stageId,
        value: pick(c, dir),
        restore: restoreOf(c, dir),
      }),
    ),
  ]
}
