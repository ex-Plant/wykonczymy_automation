import { catalogueKey } from '../../lib/kosztorys/work-catalogue/catalogue-key'
import { stripSectionOrdinal } from '../../lib/kosztorys/work-catalogue/section-category'
import type { CatalogueSeedItemT } from '../../lib/kosztorys/work-catalogue/types'
import type { ParsedSheetT, ParsedWorkT } from './parse-dumped-sheet'

// Widoczny dopisek do nazwy, kasowany ręcznie przy przeglądzie katalogu — ustalenie 5 właściciela,
// świadomie bez pola w bazie. Prefiks, nie sufiks: listing katalogu sortuje po `description`
// w obrębie kategorii, więc dołożone pozycje kleją się w jedną grupę zamiast rozsypać po całej liście.
export const LEGACY_PREFIX = '[stary arkusz] '

export type OccurrenceT = {
  sheetName: string
  investmentName: string | null
  clientPrice: number
  wToolsRate: number | null
  ownToolsRate: number | null
  rateKind: ParsedWorkT['rateKind']
  sectionName: string
}

export type CandidateT = CatalogueSeedItemT & {
  // Nazwa bez dopisku — raport pokazuje pracę tak, jak stoi w arkuszu.
  rawDescription: string
  // Od najświeższego arkusza; pierwsze wystąpienie jest zwycięzcą.
  occurrences: OccurrenceT[]
}

export type CollectResultT = {
  candidates: CandidateT[]
  /** Ile unikalnych kluczy z arkuszy katalog już zna. */
  skipped: number
  /** Wszystkie klucze zobaczone w arkuszach — podsumowanie raportu liczy się z tego. */
  totalKeys: number
}

/**
 * Prace ze wszystkich przeczytanych arkuszy zgrupowane po `catalogueKey`, bez tych, które katalog
 * już ma.
 *
 * Zwycięzcą jest PIERWSZE wystąpienie: arkusze przychodzą z fazy 2 posortowane od najświeższej
 * inwestycji, więc reguła „cena z najnowszego arkusza" jest tu odczytana z kolejności, a nie liczona
 * po raz drugi z dat, których zrzut mógłby już nie nieść.
 */
export function collectCandidates(
  sheets: readonly ParsedSheetT[],
  existing: ReadonlySet<string>,
): CollectResultT {
  const groups = new Map<string, { work: ParsedWorkT; occurrences: OccurrenceT[] }>()

  for (const sheet of sheets) {
    for (const work of sheet.works) {
      // Klucz z opisu SUROWEGO, przed doklejeniem prefiksu — inaczej praca dołożona dziś nie
      // trafiłaby jutro sama w siebie przy porównaniu z cennikiem.
      const key = catalogueKey(work.description, work.unit)
      const group = groups.get(key) ?? { work, occurrences: [] }
      group.occurrences.push({
        sheetName: sheet.sheetName,
        investmentName: sheet.investmentName,
        clientPrice: work.clientPrice,
        wToolsRate: work.wToolsRate,
        ownToolsRate: work.ownToolsRate,
        rateKind: work.rateKind,
        sectionName: work.sectionName,
      })
      groups.set(key, group)
    }
  }

  const candidates: CandidateT[] = []
  let skipped = 0

  for (const [matchKey, group] of groups) {
    if (existing.has(matchKey)) {
      skipped++
      continue
    }
    const winner = group.occurrences[0]
    candidates.push({
      description: `${LEGACY_PREFIX}${group.work.description}`,
      rawDescription: group.work.description,
      category: stripSectionOrdinal(winner.sectionName) || null,
      unit: group.work.unit,
      clientPrice: winner.clientPrice,
      wToolsRate: winner.wToolsRate,
      ownToolsRate: winner.ownToolsRate,
      matchKey,
      occurrences: group.occurrences,
    })
  }

  return { candidates, skipped, totalKeys: groups.size }
}
