'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { DataSheetGridRef } from 'react-datasheet-grid'
import { firstChangedHeightIndex, firstChangedRowIndex } from '@/lib/kosztorys/row-key-diff'

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
  // The dragged heights — diffed per row, so a single drag invalidates from that row down instead
  // of emptying the cache.
  heights: Readonly<Record<string, number>>,
  // Anything that changes what EVERY row measures to and says nothing about which rows those are —
  // in the preview, the column widths the text wraps against.
  contentSource?: unknown,
) {
  const previousKeys = useRef<readonly string[]>(rowKeys)
  const previousHeights = useRef(heights)
  const previousContent = useRef(contentSource)

  useLayoutEffect(() => {
    const candidates = [
      firstChangedRowIndex(previousKeys.current, rowKeys),
      firstChangedHeightIndex(previousHeights.current, heights, rowKeys),
      previousContent.current !== contentSource ? 0 : null,
    ].filter((index): index is number => index !== null)
    previousKeys.current = rowKeys
    previousHeights.current = heights
    previousContent.current = contentSource
    if (candidates.length === 0) return
    gridRef.current?.resetRowHeights(Math.min(...candidates))
  }, [gridRef, rowKeys, heights, contentSource])
}
