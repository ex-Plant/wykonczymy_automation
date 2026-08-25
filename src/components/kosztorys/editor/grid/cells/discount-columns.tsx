import { type ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { discountFromType, discountPolicy } from '@/lib/kosztorys/discount-edit'
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
// discountType too (discount-edit.ts), which a keyColumn can't do.
//
// Bound straight to the row it could not accept a decimal AT ALL: „12," parses to 12 (`Number('12.')`),
// the commit re-rendered the controlled input over the separator just typed, and the next digit
// landed on „12" — storing „12,5" as 125. The draft is what keeps the comma on screen.
function DiscountValueCell({
  rowData,
  setRowData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, unknown>) {
  const edit = useCellDraft(rowData, setRowData, discountPolicy<KosztorysV2RowT>(), stopEditing)
  if (disabled) return <ReadOnlyCellText>{decimalText(rowData.discountValue)}</ReadOnlyCellText>
  return (
    <EditableCellInput
      value={edit.draft ?? decimalText(rowData.discountValue)}
      inputMode="decimal"
      focus={focus}
      onBlur={edit.onBlur}
      onEnter={edit.onEnter}
      onEscape={edit.onEscape}
      onChange={(e) => edit.onChange(e.target.value)}
    />
  )
}

export function discountValueColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountValue',
    title: titleNode,
    keepFocus: true,
    component: DiscountValueCell,
    copyValue: ({ rowData }) => String(rowData.discountValue ?? ''),
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null, discountValue: 0 }),
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
