import type { ItemPatchT } from '@/lib/kosztorys/types'

// Undo/redo command payloads captured at the grid write seams, plus the burst-coalescing that turns
// a stream of per-keystroke onChange batches into one undo entry.
//
// react-datasheet-grid text cells run with continuousUpdates:true, so every keystroke fires a grid
// onChange. Pushing an undo command per onChange would make undo per-character (a 20-char edit = 20
// steps, enough to overflow the 50-deep stack) and would leave dead net-zero entries behind a
// type-then-revert. Coalescing collapses a burst on each (row, field) / (row×stage) into a single
// change whose `before` is the first value seen and `after` the last, dropping any whose net is zero.

export type FieldChangeT = { id: number; field: keyof ItemPatchT; before: unknown; after: unknown }
export type StageChangeT = { id: number; stageId: number; before: number; after: number }

function coalesceBy<T extends { before: unknown; after: unknown }>(
  seq: readonly T[],
  keyOf: (change: T) => string,
): T[] {
  const byKey = new Map<string, T>()
  for (const c of seq) {
    const key = keyOf(c)
    const merged = byKey.get(key)
    if (merged) merged.after = c.after
    else byKey.set(key, { ...c })
  }
  return [...byKey.values()].filter((c) => c.before !== c.after)
}

// The cell a change belongs to. Both reducers below key on it, so „the same cell" means one thing.
const fieldKey = (c: FieldChangeT) => `${c.id}:${String(c.field)}`
const stageChangeKey = (c: StageChangeT) => `${c.id}:${c.stageId}`

export const coalesceFieldChanges = (seq: readonly FieldChangeT[]): FieldChangeT[] =>
  coalesceBy(seq, fieldKey)

export const coalesceStageChanges = (seq: readonly StageChangeT[]): StageChangeT[] =>
  coalesceBy(seq, stageChangeKey)

// What the toolbar's two buttons may do while a burst is still buffering. The burst is undoable — an
// undo flushes it to a command first — and, being a fresh edit, it will clear the redo path on that
// flush, so redo must go dark now rather than offering a future the flush is about to delete
// (EX-526 #5).
export function undoAvailability(
  canUndo: boolean,
  canRedo: boolean,
  hasPendingBurst: boolean,
): { canUndo: boolean; canRedo: boolean } {
  return { canUndo: canUndo || hasPendingBurst, canRedo: canRedo && !hasPendingBurst }
}

export type GridBurstT = { fields: FieldChangeT[]; stages: StageChangeT[] }

// A burst that puts a cell back exactly where the previous command found it — the settle rolling a
// refused value back to what the cell held on entry. Inside one coalesce window the two halves meet
// in the same buffer and cancel each other above; once the window closes between them they land as
// two commands, and undoing the second hands back the number the user was told had been rejected
// (EX-737). So the pair is cancelled here instead, on both sides: the prefix leaves the command it
// was pushed in, and the rollback never becomes one.
//
// Only an exact there-and-back cancels. A burst that CONTINUES the previous one keeps both, because
// the two are then genuine successive states of the cell and each owes the user an undo step.
function foldPair<T extends { before: unknown; after: unknown }>(
  previous: readonly T[],
  next: readonly T[],
  keyOf: (change: T) => string,
): { previous: T[]; next: T[]; retracted: boolean } {
  const nextByKey = new Map(next.map((c) => [keyOf(c), c]))
  const cancelled = new Set<string>()
  for (const before of previous) {
    const after = nextByKey.get(keyOf(before))
    if (after && before.after === after.before && before.before === after.after) {
      cancelled.add(keyOf(before))
    }
  }
  if (cancelled.size === 0) return { previous: [...previous], next: [...next], retracted: false }
  return {
    previous: previous.filter((c) => !cancelled.has(keyOf(c))),
    next: next.filter((c) => !cancelled.has(keyOf(c))),
    retracted: true,
  }
}

export function foldRetractions(
  previous: GridBurstT,
  next: GridBurstT,
): { previous: GridBurstT; next: GridBurstT; retracted: boolean } {
  const fields = foldPair(previous.fields, next.fields, fieldKey)
  const stages = foldPair(previous.stages, next.stages, stageChangeKey)
  return {
    previous: { fields: fields.previous, stages: stages.previous },
    next: { fields: fields.next, stages: stages.next },
    retracted: fields.retracted || stages.retracted,
  }
}
