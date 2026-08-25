import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { discountFromType, discountPolicy } from '@/lib/kosztorys/discount-edit'
import { cellPaste } from '@/lib/kosztorys/cell-edit'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import { decimalText } from '@/lib/utils/decimal-text'
import type { DiscountTypeT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Bez rabatu' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

// The type/value transitions live in discount-edit.ts — see there for why they're paired.
function DiscountTypeCell({ rowData, setRowData, disabled }: CellProps<KosztorysV2RowT, unknown>) {
  if (disabled) {
    const label = DISCOUNT_OPTIONS.find((o) => o.value === (rowData.discountType ?? ''))?.label
    return <ReadOnlyCellText>{label}</ReadOnlyCellText>
  }
  return (
    <CellSelectMenu
      value={rowData.discountType ?? ''}
      options={DISCOUNT_OPTIONS}
      hideChevron
      onChange={(next) =>
        setRowData({
          ...rowData,
          ...discountFromType(rowData, (next || null) as DiscountTypeT | null),
        })
      }
    />
  )
}

// A hand-rolled input rather than a stock numeric column, because an edit here has to reach
// discountType too (discount-edit.ts), which a keyColumn can't do. The draft contract it runs on —
// and the „12,5" → 125 incident behind it — is use-cell-draft.ts.
function DiscountValueCell({
  rowData,
  setRowData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, unknown>) {
  const edit = useCellDraft(rowData, setRowData, discountPolicy<KosztorysV2RowT>(), stopEditing)
  const text = decimalText(rowData.discountValue)
  if (disabled) return <ReadOnlyCellText>{text}</ReadOnlyCellText>
  return <EditableCellInput {...edit.inputProps} value={edit.draft ?? text} focus={focus} />
}

export function discountValueColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  const policy = discountPolicy<KosztorysV2RowT>()
  return {
    id: 'discountValue',
    title: titleNode,
    component: DiscountValueCell,
    // Through the policy, not a hand-written pair: „what an emptied rabat means" is one rule, and it
    // has to say the same thing whether the user cleared the field or hit Delete on the cell.
    copyValue: ({ rowData }) => decimalText(rowData.discountValue),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}

export function discountTypeColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountType',
    title: titleNode,
    component: DiscountTypeCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.discountType ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null }),
    pasteValue: ({ rowData, value }) => ({
      ...rowData,
      discountType: (value === 'percent' || value === 'amount'
        ? value
        : null) as DiscountTypeT | null,
    }),
  }
}
