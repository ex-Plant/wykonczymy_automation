'use client'

import { createJsonMapStore, useJsonMap } from '@/hooks/create-json-map-store'

// Row heights the owner dragged = row id→px map, persisted in localStorage. Sparse on purpose: only
// rows someone actually dragged get an entry, so a 400-row kosztorys carries a handful of numbers
// and everything else resolves to the resting height. Same store mechanics as useColumnWidths.
const store = createJsonMapStore<number>('kosztorys-v2-row-heights')

// `dropHeight` matters because Postgres hands a deleted row's id back out eventually, so a leftover
// entry would silently pin a brand-new pozycja to the dead one's height. Variadic so deleting a whole
// section drops its rows in one write instead of one re-render each.
export function useRowHeights(): {
  heights: Record<string, number>
  setHeight: (rowId: string, height: number) => void
  dropHeight: (...rowIds: string[]) => void
} {
  return { heights: useJsonMap(store), setHeight: store.set, dropHeight: store.drop }
}
