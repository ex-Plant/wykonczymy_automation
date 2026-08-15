'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'
import type { ColumnRanksT } from '@/lib/kosztorys/column-order'

// User-defined column order = group key → rank, persisted in localStorage. Sparse: only groups the
// owner actually dragged get an entry, so an empty map is exactly today's sheet order and a column
// added later ships at its declared position. Global, not per-kosztorys — a reading order is a
// property of the person reading, like widths and hidden columns. Store mechanics live in
// createJsonMapStore, shared with useColumnWidths / useHiddenColumns.
const store = createJsonMapStore<number>('kosztorys-v2-col-order')

// Returns the raw map, unlike useHiddenColumns: here an absent key means "rank at the assemble
// index", a fallback only orderColumnKeys can resolve (it needs the whole list), so there is no
// per-key reader that could lie.
export function useColumnOrder(): {
  ranks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
} {
  const ranks = useJsonMap<number>(store)

  function setRank(key: string, rank: number) {
    store.update((prev) => ({ ...prev, [key]: rank }))
  }

  // Writes an empty map rather than removing the key — subscribers are notified through update(),
  // and the identity return on an already-empty map skips a pointless write.
  function resetOrder() {
    store.update((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }

  return { ranks, setRank, resetOrder }
}
