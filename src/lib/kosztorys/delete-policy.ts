import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Deleting the last item of a section takes the section with it, so no orphaned 0-row section is
// left behind — the one thing a caller must know before removing an item. Pure so the handler and
// its confirm dialog can't disagree about which of the two deletes is about to happen.
export function isLastItemInSection(rows: KosztorysV2RowT[], row: KosztorysV2RowT): boolean {
  return !rows.some((r) => r.sectionId === row.sectionId && r.id !== row.id)
}

// Item-count per section in one O(n) pass, feeding the „Usunie też N pozycji" line of the section
// confirm. Precomputed once per render because every row's actions menu reads its own section's
// count — rescanning per row would make that O(n²) across the grid.
export function sectionItemCounts(rows: KosztorysV2RowT[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.sectionId, (counts.get(r.sectionId) ?? 0) + 1)
  return counts
}
