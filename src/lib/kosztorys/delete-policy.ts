import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export function sectionItemCount(rows: KosztorysV2RowT[], sectionId: number): number {
  return rows.reduce((n, r) => (r.sectionId === sectionId ? n + 1 : n), 0)
}

// Item-count per section in one O(n) pass. Precompute once per render so the render-hot
// getRemovePlan is O(1) per row (a Map lookup) instead of re-scanning all rows per row — the
// per-cell sectionItemCount call made the delete plan O(n²) across the grid.
export function sectionItemCounts(rows: KosztorysV2RowT[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.sectionId, (counts.get(r.sectionId) ?? 0) + 1)
  return counts
}

export const REMOVE_BLOCK_LAST_ITEM = 'Kosztorys musi mieć co najmniej jedną pozycję'

export type ItemRemovalPlanT =
  | { kind: 'blocked'; reason: string }
  | { kind: 'cascade-section' }
  | { kind: 'remove-item' }

// The render-hot path passes precomputed totals (from sectionItemCounts) so it never rescans the
// dataset per cell. The plan says what the delete DOES, never whether to confirm: every delete goes
// through the dialog, including one that destroys recorded stage progress (EX-477).
export function planItemRemovalFromCounts(
  totalRows: number,
  sectionCount: number,
): ItemRemovalPlanT {
  // Floor: keep ≥1 item in the whole sheet so the editor never goes fully empty.
  if (totalRows <= 1) return { kind: 'blocked', reason: REMOVE_BLOCK_LAST_ITEM }
  // Last item in its section → cascade-delete the section so no orphaned 0-row section is left.
  if (sectionCount <= 1) return { kind: 'cascade-section' }
  return { kind: 'remove-item' }
}

// Pure so the disabled-tooltip reason and the delete handler share one source of truth
// (use-kosztorys-editor). Event-time callers use this; the render-hot path goes through
// planItemRemovalFromCounts + sectionItemCounts.
export function planItemRemoval(rows: KosztorysV2RowT[], row: KosztorysV2RowT): ItemRemovalPlanT {
  return planItemRemovalFromCounts(rows.length, sectionItemCount(rows, row.sectionId))
}
