import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'

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

// `keys` is the group-key list in assemble (sheet) order. Anchors keep their index; every other key
// is redistributed across the remaining slots sorted by effective rank, ties broken by assemble
// index so the result is a total order and an empty rank map is a no-op.
export function orderColumnKeys(keys: readonly string[], ranks: ColumnRanksT): string[] {
  const movable = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => !ANCHORED_COLUMN_KEYS.has(key))
  const sorted = [...movable].sort(
    (a, b) =>
      effectiveRank(a.key, a.index, ranks) - effectiveRank(b.key, b.index, ranks) ||
      a.index - b.index,
  )
  const ordered = [...keys]
  movable.forEach(({ index }, slot) => {
    ordered[index] = sorted[slot].key
  })
  return ordered
}

// The single rank to persist so that `key` lands at `toIndex` among the movable keys.
//
// Interior drops take the midpoint of their new neighbours; the two edges take min−1 / max+1 over the
// whole list rather than neighbour∓1. Both choices exist to keep effective ranks pairwise DISTINCT:
// a midpoint of a gap that holds no other rank can't collide, and a global extreme can't either. Ties
// would fall through to the assemble index, which no scalar rank can then override.
export function rankForMove(
  orderedMovableKeys: readonly string[],
  key: string,
  toIndex: number,
  ranks: ColumnRanksT,
  baseRanks: Record<string, number>,
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
export function baseRanksFromKeys(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key, index) => [key, index]))
}

// The same ordering over a full column list. Columns collapse into their `toKey` group first (stage
// columns share one key and must travel as a block), so a group keeps its internal order and moves
// as one.
export function orderColumns<T extends { id?: string }>(
  columns: readonly T[],
  ranks: ColumnRanksT,
  toKey: (id: string) => string,
): T[] {
  const groups = new Map<string, T[]>()
  const keys: string[] = []
  for (const column of columns) {
    const key = toKey(column.id ?? '')
    const group = groups.get(key)
    if (group) {
      group.push(column)
      continue
    }
    groups.set(key, [column])
    keys.push(key)
  }
  return orderColumnKeys(keys, ranks).flatMap((key) => groups.get(key) ?? [])
}
