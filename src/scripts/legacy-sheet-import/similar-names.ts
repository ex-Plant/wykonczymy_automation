import { foldDescription } from '../../lib/kosztorys/sheet-import/item-key'
import { bigrams, diceSimilarity } from '../../lib/utils/string-similarity'

// Ten sam próg, co podpowiedzi „może chodzi o…" w porównaniu z cennikiem
// (`build-catalogue-comparison.ts`) — miara Dice na bigramach żyje w `lib/utils/string-similarity`,
// więc jest już wspólna i nie ma czego wyciągać.
const THRESHOLD = 0.55

export type NamedWorkT = { description: string; unit: string }

export type SimilarPairT = {
  left: NamedWorkT
  right: NamedWorkT
  score: number
  // „katalog" = drugą stroną jest pozycja już w katalogu, „kandydat" = obie strony są nowe.
  side: 'katalog' | 'kandydat'
}

type IndexedT = NamedWorkT & { pairs: string[] }

const index = (works: readonly NamedWorkT[]): IndexedT[] =>
  works.map((work) => ({ ...work, pairs: bigrams(foldDescription(work.description)) }))

/**
 * Pary nazw na tyle podobne, że mogą być tą samą pracą zapisaną inaczej. Wyłącznie sygnał do
 * raportu: nic nie skleja, bo złe sklejenie daje jedną wiarygodnie wyglądającą pozycję ze złą ceną,
 * a duplikat po prostu widać i kasuje się go ręcznie (ustalenie 6 właściciela).
 */
export function findSimilarNames(
  candidateWorks: readonly NamedWorkT[],
  catalogueWorks: readonly NamedWorkT[],
): SimilarPairT[] {
  const candidates = index(candidateWorks)
  const catalogue = index(catalogueWorks)
  const pairs: SimilarPairT[] = []

  for (let left = 0; left < candidates.length; left++) {
    for (let right = left + 1; right < candidates.length; right++) {
      const score = diceSimilarity(candidates[left].pairs, candidates[right].pairs)
      if (score >= THRESHOLD)
        pairs.push({
          left: candidates[left],
          right: candidates[right],
          score,
          side: 'kandydat',
        })
    }
    let best: SimilarPairT | null = null
    for (const entry of catalogue) {
      const score = diceSimilarity(candidates[left].pairs, entry.pairs)
      if (score >= THRESHOLD && (!best || score > best.score))
        best = {
          left: candidates[left],
          right: entry,
          score,
          side: 'katalog',
        }
    }
    if (best) pairs.push(best)
  }

  return pairs.sort((a, b) => b.score - a.score)
}
