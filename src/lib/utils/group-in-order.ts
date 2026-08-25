// A Map keeps insertion order, so its keys ARE the display sequence — every caller here reads the
// order off this one pass instead of storing a second sequence beside the groups.
export function groupInOrder<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const group = groups.get(keyOf(item))
    if (group) group.push(item)
    else groups.set(keyOf(item), [item])
  }
  return groups
}

// The other half of the pattern: reorder by editing the KEY sequence and re-concatenating whole
// groups, never by splicing item indices — a group's items aren't guaranteed adjacent, and this
// pulls a stray one back into its block where an index splice would land past the wrong item.
export function regroupByKeys<T, K>(groups: Map<K, T[]>, keys: readonly K[]): T[] {
  return keys.flatMap((key) => groups.get(key) ?? [])
}
