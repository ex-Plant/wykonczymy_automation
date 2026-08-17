import { round6 } from './derive-override'

export type SheetCoeffsT = { wTools: number | null; ownTools: number | null }

export type RateSampleT = { rate: number; clientPrice: number; tracksClientPrice: boolean }

// The most common ratio, or null when there is nothing to count. Ties go to whichever value was
// seen first — a sheet split evenly between two markups has no dominant one, and either answer is
// as good as a coin flip that also has to be explained.
function mode(ratios: readonly number[]): number | null {
  const counts = new Map<number, number>()
  for (const ratio of ratios) counts.set(ratio, (counts.get(ratio) ?? 0) + 1)

  let best: number | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * The markup the sheet applies to everything, read off the rows that actually follow Cena j.m.
 *
 * The sheet has no cell holding this number — it is baked into hundreds of copies of the same
 * formula (`=P×0,65`), so the only way to recover it is to count. Rows with a hand-typed stawka are
 * excluded on purpose: those are decisions about one praca and would drag the global figure toward
 * whatever the owner happened to type most often.
 *
 * Why it matters beyond bookkeeping: this is what lets a formula row import as „auto" instead of a
 * per-row „własny mnożnik". Handing a row to the global coefficient is only safe while the global
 * coefficient IS the sheet's — otherwise the import would quietly reprice the row at whatever the
 * investment happened to be set to.
 */
export function sheetCoeffs(
  wToolsSamples: readonly RateSampleT[],
  ownToolsSamples: readonly RateSampleT[],
): SheetCoeffsT {
  const ratios = (samples: readonly RateSampleT[]): number[] =>
    samples
      .filter((sample) => sample.tracksClientPrice && sample.rate > 0 && sample.clientPrice > 0)
      .map((sample) => round6(sample.rate / sample.clientPrice))

  return { wTools: mode(ratios(wToolsSamples)), ownTools: mode(ratios(ownToolsSamples)) }
}
