// The grid caches each row's height and vertical position by INDEX and never invalidates that cache
// on its own, so an insert or a delete leaves every row below reading the previous occupant's
// height — a section band lands at item height and the item above it at band height. Recomputing
// from the first index whose row identity moved is what repairs it, and starting any later leaves
// the shifted rows on stale values.
export function firstChangedRowIndex(
  prev: readonly string[],
  next: readonly string[],
): number | null {
  const shared = Math.min(prev.length, next.length)
  for (let i = 0; i < shared; i++) {
    if (prev[i] !== next[i]) return i
  }
  // Same rows in the same order, one list merely longer: the appended tail was never measured, so
  // nothing cached is stale.
  return prev.length === next.length ? null : shared
}
