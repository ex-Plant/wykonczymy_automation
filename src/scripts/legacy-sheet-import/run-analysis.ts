import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkCatalogueItemT } from '../../lib/kosztorys/work-catalogue/types'
import { DUMP_DIR, type SheetDumpT } from './dump-store'
import { parseDumpedSheet, type ParsedSheetT, type SheetParseFailureT } from './parse-dumped-sheet'
import { collectCandidates, type CandidateT } from './collect-candidates'

export type AnalysisT = {
  sheets: ParsedSheetT[]
  failures: SheetParseFailureT[]
  candidates: CandidateT[]
  skipped: number
  totalKeys: number
}

/**
 * Cały przebieg B w jednej funkcji, bo wsad z fazy 4 musi wstawić DOKŁADNIE to, co przeczytał
 * raport — dwie kopie tej samej ścieżki rozjechałyby się przy pierwszej poprawce i nikt by tego nie
 * zauważył, bo raport i baza nie stoją obok siebie.
 */
export function runAnalysis(catalogue: readonly WorkCatalogueItemT[]): AnalysisT {
  // Kolejność świeżości NIE jest liczona od nowa z bazy: `investmentCreatedAt` pojechało na dysk
  // razem ze zrzutem właśnie po to, żeby przebieg B odtworzył ten sam porządek bez sieci i bez
  // pytania o inwestycję, która mogła się w międzyczasie zmienić. `readdirSync` jest tylko listą.
  const dumps = readdirSync(DUMP_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(DUMP_DIR, name), 'utf8')) as SheetDumpT)
    .sort((a, b) => {
      const byDate = (b.investmentCreatedAt ?? '').localeCompare(a.investmentCreatedAt ?? '')
      return byDate !== 0 ? byDate : (b.investmentId ?? 0) - (a.investmentId ?? 0)
    })

  const sheets: ParsedSheetT[] = []
  const failures: SheetParseFailureT[] = []
  for (const dump of dumps) {
    const result = parseDumpedSheet(dump)
    if (result.ok) sheets.push(result.sheet)
    else failures.push(result.failure)
  }

  const { candidates, skipped, totalKeys } = collectCandidates(
    sheets,
    new Set(catalogue.map((item) => item.matchKey)),
  )
  return { sheets, failures, candidates, skipped, totalKeys }
}
