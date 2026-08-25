'use client'

import { createJsonMapStore, dropKeys, useJsonMap } from '@/hooks/create-json-map-store'

// Grid column widths = id→px map, persisted in localStorage. Sparse: only columns the user actually
// dragged get an entry — the rest stay on flex (grow/minWidth). Store mechanics (subscribe, safe
// read, updater-based write) live in createJsonMapStore, shared with useHiddenColumns.
const store = createJsonMapStore<number>('kosztorys-v2-col-widths')

export function useColumnWidths(): {
  widths: Record<string, number>
  setWidth: (id: string, width: number) => void
  dropWidth: (...ids: string[]) => void
} {
  const widths = useJsonMap(store)

  function setWidth(id: string, width: number) {
    store.update((prev) => ({ ...prev, [id]: width }))
  }

  // A stage column's id is derived from its DB id, which Postgres can hand out again after the stage
  // is deleted — so a leftover entry would silently pin a brand-new stage to the dead one's width.
  // Variadic so a stage's several columns (ilość + kwota netto + brutto + %) drop in one write
  // instead of one re-render each.
  function dropWidth(...ids: string[]) {
    store.update((prev) => dropKeys(prev, ids))
  }

  return { widths, setWidth, dropWidth }
}
