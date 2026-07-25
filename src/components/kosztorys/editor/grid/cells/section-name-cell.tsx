import { ReadOnlyCellText } from '@/components/kosztorys/editor/grid/cells/read-only-cell-text'
import { EditableCellInput } from '@/components/kosztorys/editor/grid/cells/editable-cell-input'
import { useInlineRename } from '@/components/kosztorys/editor/use-inline-rename'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Renames the WHOLE section, so it commits through onRename (the same fan-out the section panel uses)
// — never setRowData, which would rewrite only this row's copy of the denormalized name. A stray grid
// Delete is a no-op (deleteValue returns the row) so it can't blank the section.
export function SectionNameCell({
  rowData,
  onRename,
  disabled,
}: {
  rowData: KosztorysV2RowT
  onRename?: (sectionId: number, name: string) => void
  disabled?: boolean
}) {
  const { editing, start, inputProps } = useInlineRename((name) =>
    onRename?.(rowData.sectionId, name),
  )

  if (disabled) return <ReadOnlyCellText>{rowData.sectionName ?? ''}</ReadOnlyCellText>

  return (
    <EditableCellInput
      {...inputProps}
      // The cell stays mounted when not editing, so it shows the row's canonical name — an external
      // rename (from the section panel) can't go stale behind a leftover draft.
      value={editing ? inputProps.value : (rowData.sectionName ?? '')}
      onFocus={() => start(rowData.sectionName ?? '')}
    />
  )
}
