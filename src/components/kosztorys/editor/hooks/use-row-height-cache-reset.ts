'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { DataSheetGridRef } from 'react-datasheet-grid'
import { firstChangedRowIndex } from '@/lib/kosztorys/row-key-diff'

// The grid keeps every row's measured height and vertical offset in a ref keyed by index and never
// clears it — the library's own `resetAfter` is defined and never called, which is what a local
// patch exposes as `resetRowHeights`. Nothing else calls it, so without this hook an insert leaves
// a section band drawn at item height and the item above it at band height (EX-699).
//
// Layout effect, not a plain effect: the reset re-renders the grid, and running it after paint
// would show one frame of rows at their previous heights.
export function useRowHeightCacheReset(
  gridRef: RefObject<DataSheetGridRef | null>,
  rowKeys: readonly string[],
) {
  const previousKeys = useRef<readonly string[]>(rowKeys)

  useLayoutEffect(() => {
    const from = firstChangedRowIndex(previousKeys.current, rowKeys)
    previousKeys.current = rowKeys
    if (from === null) return
    gridRef.current?.resetRowHeights(from)
  }, [gridRef, rowKeys])
}
