// Dice over letter bigrams: cheap, order-insensitive enough for „Gładź gipsowa" against „Gładzie
// gipsowe", and — unlike a prefix test — unbothered by a difference at the front of the name.
export function bigrams(value: string): string[] {
  const pairs: string[] = []
  for (let i = 0; i < value.length - 1; i += 1) pairs.push(value.slice(i, i + 2))
  return pairs
}

/**
 * Dice coefficient over two precomputed bigram lists. The caller passes the lists rather than the
 * strings so a one-against-many search folds each candidate once instead of once per comparison.
 */
export function diceSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) return 0

  const pool = new Map<string, number>()
  for (const pair of left) pool.set(pair, (pool.get(pair) ?? 0) + 1)

  let shared = 0
  for (const pair of right) {
    const remaining = pool.get(pair) ?? 0
    if (remaining > 0) {
      shared += 1
      pool.set(pair, remaining - 1)
    }
  }
  return (2 * shared) / (left.length + right.length)
}
