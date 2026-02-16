/**
 * Performance measurement utility.
 * Wraps an async operation and logs its duration.
 * Temporary — remove after profiling (M21 Phase 1).
 */
export async function perf<TResult>(label: string, fn: () => Promise<TResult>): Promise<TResult> {
  const start = performance.now()
  const result = await fn()
  const ms = performance.now() - start
  console.log(`[PERF] ${label} ${ms.toFixed(1)}ms`)
  return result
}

/** Marks a point in time, returns elapsed ms since start. */
export function perfStart(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}
