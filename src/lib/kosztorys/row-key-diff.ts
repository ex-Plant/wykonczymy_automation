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

// The same question for the height map the owner drags: which is the first row whose stored height
// moved. Resetting the whole cache instead would be correct but visibly worse — dsg computes the
// grid's own box from the cache during render, and an emptied cache measures as roughly one row, so
// the grid collapses and re-expands on every drag release until its resize detector catches up.
export function firstChangedHeightIndex(
  prev: Readonly<Record<string, number>>,
  next: Readonly<Record<string, number>>,
  rowKeys: readonly string[],
): number | null {
  if (prev === next) return null
  let earliest: number | null = null
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (prev[key] === next[key]) continue
    const index = rowKeys.indexOf(key)
    // A height for a row this view doesn't render (a filtered-out pozycja, the header's own entry)
    // invalidates nothing on screen.
    if (index === -1) continue
    if (earliest === null || index < earliest) earliest = index
  }
  return earliest
}
