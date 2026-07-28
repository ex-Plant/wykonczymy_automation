'use client'

import { type CellProps, type SimpleColumn } from 'react-datasheet-grid'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Same module-level-identity rule as SyntheticAwareCell: the ordinals ride on `columnData`, never a
// closure. dsg's default gutter prints `rowIndex + 1`, which counts bands and the spacer/„Razem"
// rows; the precomputed map numbers only the real item rows, and returns nothing for the rest.
function OrdinalGutterCell({
  rowData,
  columnData,
}: CellProps<KosztorysV2RowT, Map<number, number>>) {
  return <>{columnData.get(rowData.id) ?? ''}</>
}

/**
 * dsg's leftmost column is the only sticky-left element it gives us, so it is the one place a
 * per-row indicator survives horizontal scroll — which is why this column carries BOTH the item
 * ordinal (its cell) and the section colour rail (painted on `.dsg-cell-gutter` in globals.css).
 *
 * `title` blanks dsg's corner indicator: the ordinals are chrome, not a column the header should
 * announce.
 */
export function ordinalGutterColumn(
  ordinalByRowId: Map<number, number>,
): SimpleColumn<KosztorysV2RowT, Map<number, number>> {
  return {
    // dsg's own 5px side padding plus room for a four-digit ordinal (a kosztorys can run past 1000
    // rows) and the 3px rail.
    basis: 38,
    title: <></>,
    component: OrdinalGutterCell,
    columnData: ordinalByRowId,
  }
}
