import type { MouseEvent } from 'react'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Renames the WHOLE section, so it commits through onRename (the same fan-out the section panel uses)
// — never setRowData, which would rewrite only this row's copy of the denormalized name. A stray grid
// Delete is a no-op (deleteValue returns the row) so it can't blank the section.
export function SectionNameCell({
  rowData,
  onRename,
  disabled,
  className,
  onClick,
}: {
  rowData: KosztorysV2RowT
  onRename?: (sectionId: number, name: string) => void
  disabled?: boolean
  className?: string
  onClick?: (event: MouseEvent<HTMLInputElement>) => void
}) {
  const { editing, start, inputProps } = useInlineRename((name) =>
    onRename?.(rowData.sectionId, name),
  )

  if (disabled) return <ReadOnlyCellText>{rowData.sectionName ?? ''}</ReadOnlyCellText>

  // The cell stays mounted when not editing, so it shows the row's canonical name — an external
  // rename (from the section panel) can't go stale behind a leftover draft.
  const shown = editing ? String(inputProps.value ?? '') : (rowData.sectionName ?? '')

  return (
    <EditableCellInput
      {...inputProps}
      className={className}
      value={shown}
      // Fallback for engines without `field-sizing: content` (which the band relies on to hug the
      // name): without it an input ignores its value and renders at a fixed ~20-character default.
      size={Math.max(shown.length, 1)}
      onFocus={() => start(rowData.sectionName ?? '')}
      onClick={onClick}
    />
  )
}
