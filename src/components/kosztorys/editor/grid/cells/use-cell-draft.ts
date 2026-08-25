import { useState, type KeyboardEvent } from 'react'
import { cellKeystroke, cellSettle, type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { toastMessage } from '@/lib/utils/toast'

// Longer than the default 2s: this one reports work being undone, and it fires as the user's eyes
// are already moving to the next cell.
const REVERT_TOAST_MS = 5000

type StopEditingT = (opts?: { nextRow?: boolean }) => void

/**
 * The editing lifecycle every numeric cell in the grid shares — the React half of `cell-edit.ts`,
 * kept as thin as it can be because this repo has no hook renderer and nothing in here is testable.
 *
 * The trap it exists for: keystrokes commit as they go, so a value the policy refuses leaves the
 * last accepted PREFIX standing on the row. Typing „12,5" is the everyday version — the comma
 * commits „12", and a cell bound straight to the row re-renders over the separator the user just
 * typed, so the „5" lands on „12" and the row stores 125. So the text is held as a draft while the
 * caret is in the cell, and leaving settles it: accepted values stay, refused ones roll the row back
 * to what it was on entry and say so out loud.
 */
export function useCellDraft<RowT extends { id: number }, EntryT>(
  rowData: RowT,
  setRowData: (row: RowT) => void,
  policy: CellEditPolicyT<RowT, EntryT>,
  stopEditing: StopEditingT,
) {
  const [blockReason, setBlockReason] = useState<string | null>(null)
  // The text as typed, the value it started from, and the row it belongs to. Bound straight to the
  // row instead, anything the row won't accept (a cleared field, a half-typed „50,") snaps back
  // under the user's hands on the very next keystroke.
  const [edit, setEdit] = useState<{
    draft: string
    entry: EntryT
    rowId: number
  } | null>(null)

  const change = (draft: string) => {
    setEdit({ draft, entry: edit?.entry ?? policy.snapshot(rowData), rowId: rowData.id })
    const result = cellKeystroke(draft, rowData, policy)
    setBlockReason(result.kind === 'blocked' ? result.message : null)
    if (result.kind === 'commit') setRowData(result.row)
  }

  const settle = () => {
    setBlockReason(null)
    setEdit(null)
    // The draft lives at a grid POSITION, and the row underneath it can change without the cell ever
    // losing focus (a filter, a refresh landing mid-edit). Settling then would write one row's entry
    // snapshot onto another.
    if (!edit || edit.rowId !== rowData.id) return
    const settled = cellSettle(edit.draft, rowData, policy, edit.entry)
    if (settled.kind === 'keep') return
    if (settled.kind === 'clear') {
      setRowData(settled.row)
      return
    }
    if (settled.row) setRowData(settled.row)
    // A refused value leaves an older number on screen in its place, so the revert says so out loud —
    // silently swapping the figure under the user is how they end up trusting a value they never
    // chose. Garbage that displaced nothing is the one case that stays quiet.
    if (settled.reason === 'blocked' || settled.row) {
      toastMessage(
        `${settled.reason === 'blocked' ? 'Wartość odrzucona' : 'Nieprawidłowa wartość'} — przywrócono ${policy.restoredLabel(settled.restored)}.`,
        'error',
        REVERT_TOAST_MS,
      )
    }
  }

  // Escape abandons the edit without a word — the user said so themselves. It does NOT blur itself:
  // the rollback has to be the last write, and a synchronous blur would settle the draft this render
  // still holds. Handing the cell back to the grid blurs it a render later, by which time the draft
  // is gone and `settle` no-ops on its own row guard.
  const cancel = () => {
    setBlockReason(null)
    setEdit(null)
    if (edit && edit.rowId === rowData.id) setRowData(policy.restore(rowData, edit.entry))
  }

  return {
    draft: edit?.draft ?? null,
    blockReason,
    onChange: change,
    onBlur: settle,
    // Enter hands over to blur rather than settling itself, so there is exactly one settle path, then
    // hands the cell back to the grid — without that the grid stays in edit mode on a cell whose input
    // has already blurred, and the keyboard model the rest of the columns follow (Enter commits and
    // steps down, Escape returns to selection) simply stops at these two.
    onEnter: (event: KeyboardEvent<HTMLInputElement>) => {
      event.currentTarget.blur()
      stopEditing({ nextRow: true })
    },
    onEscape: () => {
      cancel()
      // Explicit: `stopEditing`'s own default is `{ nextRow: true }`, so a bare call on a cancel path
      // silently walks the selection down a row.
      stopEditing({ nextRow: false })
    },
  }
}
