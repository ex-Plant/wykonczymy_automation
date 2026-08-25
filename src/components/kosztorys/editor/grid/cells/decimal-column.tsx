import type { ReactNode } from 'react'
import type { CellProps, Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import type { CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { decimalText } from '@/lib/utils/decimal-text'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'

// A plain number cell — „Cena j.m." in the client view, „Przedmiar", a stage's „ilość" — on the same
// contract as the guarded ones (use-cell-draft.ts).
//
// It replaces a `keyColumn` + `createTextColumn` pair, whose `parseUserInput(value: string)` is the
// reason the contract was unreachable from there: the parser never sees the value it is replacing,
// so „keep what was there" is unexpressible and `empty` and `invalid` both collapse to `null` — into
// fields typed `number`. „-" typed into „Przedmiar" wiped the quantity; here it is held on screen and
// rolled back on the way out.

// The policy travels via `columnData` so the component below keeps ONE identity across renders — an
// inline `component: ({rowData}) => …` is a fresh function type on every assembleV2Columns call, and
// react-datasheet-grid answers a changed component type with a remount, tearing down the <input>
// mid-edit and dropping all but the last character typed (EX-422, lessons.md:119-135).
type DecimalCellDataT = { policy: CellEditPolicyT<KosztorysV2RowT, number> }

function DecimalCell({
  rowData,
  setRowData,
  columnData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, DecimalCellDataT>) {
  const { policy } = columnData
  const edit = useCellDraft(rowData, setRowData, policy, stopEditing)
  // For a lone numeric field the entry snapshot IS the value — which is why this column takes only
  // single-field policies, and why nothing here needs to know the field's name.
  const text = decimalText(policy.snapshot(rowData))
  // dsg leaves a disabled cell's component untouched and merely refuses the keystrokes, so a stock
  // cell renders a live-looking input nobody can type into. The preview grid disables every column.
  if (disabled) return <ReadOnlyCellText>{text}</ReadOnlyCellText>
  return (
    <EditableCellInput
      value={edit.draft ?? text}
      inputMode="decimal"
      focus={focus}
      onBlur={edit.onBlur}
      onEnter={edit.onEnter}
      onEscape={edit.onEscape}
      onChange={(e) => edit.onChange(e.target.value)}
    />
  )
}

export function decimalColumn(
  id: string,
  titleNode: ReactNode,
  policy: CellEditPolicyT<KosztorysV2RowT, number>,
): Column<KosztorysV2RowT> {
  return {
    id,
    title: titleNode,
    columnData: { policy },
    component: DecimalCell,
    // No thousands separator on the way out — it would not survive the round trip back in. Stripped
    // on the way IN because a paste from the owner's sheet carries one (a NBSP).
    copyValue: ({ rowData }) => decimalText(policy.snapshot(rowData)),
    pasteValue: ({ rowData, value }) => {
      const parsed = parseDecimalInput(value.replace(/\s/g, ''))
      if (parsed.kind === 'empty') return policy.clear(rowData)
      // Garbage in the clipboard leaves the row alone, the same answer typing it gets.
      if (parsed.kind === 'invalid') return rowData
      const next = policy.applyValue(rowData, parsed.value)
      return policy.guard?.(next) ? rowData : next
    },
    deleteValue: ({ rowData }) => policy.clear(rowData),
    // Re-owned deliberately (lessons.md:906): dsg reads this to decide whether Delete on a selection
    // means "blank these cells" or "remove these rows". Every field behind this column is a
    // non-nullable `number`, so it is never the empty cell that would consent to a row deletion —
    // which is exactly what `keyColumn`'s null check answered here before.
    isCellEmpty: () => false,
  }
}
