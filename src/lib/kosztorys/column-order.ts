import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'
import { groupInOrder, regroupByKeys } from '@/lib/utils/group-in-order'

// Two columns hold a fixed slot instead of a rank. `description` carries the section band's label,
// the „Razem" row and the section footer (dsg has no colspan, so those paint into this cell), and
// the actions column is the row's own menu — dragging either to the far right would leave the band
// blank with its name stranded off-screen.
//
// A fixed SLOT, not "pinned to the front": `description` sits today BEHIND „Rozjazd", so forcing it
// to index 0 would quietly restyle the default grid the moment anyone reorders anything.
export const ANCHORED_COLUMN_KEYS: ReadonlySet<string> = new Set(['actions', IDENTITY_COLUMN_ID])

export type ColumnRanksT = Record<string, number>

// Sparse by design (same argument as useHiddenColumns): a key with no entry ranks at its position in
// the assembled list, so a column added later lands where the code declares it instead of at the end.
function effectiveRank(key: string, assembleIndex: number, ranks: ColumnRanksT): number {
  return ranks[key] ?? assembleIndex
}

export function movableColumnKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => !ANCHORED_COLUMN_KEYS.has(key))
}

// The anchoring rule itself: anchors keep their assemble slot, `movableOrder` fills the rest in its
// own order. The grid and the reorder window must draw the SAME interleave — a window that disagrees
// with the grid it edits lies about the one thing it exists to show — so both read this one function.
export function placeMovables(keys: readonly string[], movableOrder: readonly string[]): string[] {
  let slot = 0
  return keys.map((key) => (ANCHORED_COLUMN_KEYS.has(key) ? key : (movableOrder[slot++] ?? key)))
}

// `keys` is the group-key list in assemble (sheet) order. Ties break by assemble index, so the
// result is a total order and an empty rank map is a no-op.
export function orderColumnKeys(keys: readonly string[], ranks: ColumnRanksT): string[] {
  const sorted = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => !ANCHORED_COLUMN_KEYS.has(key))
    .sort(
      (a, b) =>
        effectiveRank(a.key, a.index, ranks) - effectiveRank(b.key, b.index, ranks) ||
        a.index - b.index,
    )
  return placeMovables(
    keys,
    sorted.map(({ key }) => key),
  )
}

// The single rank to persist so that `key` lands at `toIndex` among the movable keys.
//
// Interior drops take the midpoint of their new neighbours; the two edges take min−1 / max+1 over the
// whole list rather than neighbour∓1. Both choices keep effective ranks distinct WITHIN THE VIEW the
// drop happened in: a midpoint of a gap that holds no other rank can't collide, and a global extreme
// can't either. Ties would fall through to the assemble index, which no scalar rank can then override.
//
// Only within that view, though — the rank map is global while the assemble index is per-view („Klient"
// assembles one price column, the subcontractor views three), so a rank set in one view can tie an
// unranked key in another. That resolves deterministically by assemble index; it is a weaker guarantee,
// not a broken one. Same reason a midpoint can straddle a group the picker filters out (the rabat
// columns under a global discount): invisible where it was computed, ordered once it comes back.
export function rankForMove(
  orderedMovableKeys: readonly string[],
  key: string,
  toIndex: number,
  ranks: ColumnRanksT,
  baseRanks: ColumnRanksT,
): number {
  const rankOf = (candidate: string) => ranks[candidate] ?? baseRanks[candidate] ?? 0
  const without = orderedMovableKeys.filter((candidate) => candidate !== key)
  const previous = without[toIndex - 1]
  const next = without[toIndex]
  if (previous !== undefined && next !== undefined) return (rankOf(previous) + rankOf(next)) / 2
  if (next !== undefined) return Math.min(...without.map(rankOf)) - 1
  if (previous !== undefined) return Math.max(...without.map(rankOf)) + 1
  // Nothing to move against — a one-element list is already in order.
  return rankOf(key)
}

// Assemble index per group key — the fallback rank an unmoved key sorts at, which the reorder dialog
// can't derive on its own (it only ever sees the ALREADY ordered list).
export function baseRanksFromKeys(keys: readonly string[]): ColumnRanksT {
  return Object.fromEntries(keys.map((key, index) => [key, index]))
}

// Columns collapsed into their `toKey` groups, in first-seen order. The grid's base ranks and its
// ordering must count groups the same way or a drop's midpoint lands against the wrong neighbours,
// so both read this one grouping.
export function groupColumns<T extends { id?: string }>(
  columns: readonly T[],
  toKey: (id: string) => string,
): Map<string, T[]> {
  return groupInOrder(columns, (column) => toKey(column.id ?? ''))
}

// The same ordering over a full column list. Columns collapse into their `toKey` group first (stage
// columns share one key and must travel as a block), so a group keeps its internal order and moves
// as one.
export function orderColumns<T extends { id?: string }>(
  columns: readonly T[],
  ranks: ColumnRanksT,
  toKey: (id: string) => string,
): T[] {
  const groups = groupColumns(columns, toKey)
  return regroupByKeys(groups, orderColumnKeys([...groups.keys()], ranks))
}
