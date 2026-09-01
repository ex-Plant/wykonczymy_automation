import { foldUnit } from '../../lib/kosztorys/sheet-import/columns'
import type { CandidateT } from './collect-candidates'
import type { SheetParseFailureT } from './parse-dumped-sheet'
import type { SimilarPairT } from './similar-names'

// Jednostki, które w arkuszach właściciela są normą. Wszystko poza tym zbiorem — `klp`, `n2` —
// wychodzi do przejrzenia, bo j.m. jest połową tożsamości pracy: literówka rozszczepia jedną pracę
// na dwie pozycje z dwiema cenami. Świadomie NIE jest to słownik poprawek: zgadywanie, że ktoś
// przestawił litery, decyduje o cenie pracy na wyczucie.
const KNOWN_UNITS = ['m2', 'm3', 'mb', 'szt', 'kpl', 'godz', 'kg', 't', 'l', 'pkt', 'usluga', 'm']

// J.m. na widoku: para o wyniku 1.00 różniąca się tylko jednostką to nie duplikat, tylko dwie
// prace — bez tego człowiek nie ma z czego tego rozpoznać.
const named = (work: SimilarPairT['left']) => `${work.description} [${work.unit || 'bez j.m.'}]`

const money = (value: number) => `${value.toFixed(2)} zł`
const rate = (value: number | null) => (value === null ? 'auto' : money(value))

const RATE_REASON: Record<CandidateT['occurrences'][number]['rateKind'], string> = {
  agree: '',
  single: '',
  conflict: 'cenniki arkusza nie zgadzają się ze sobą',
  missing: 'pracy nie ma w żadnym cenniku arkusza',
}

export type ReportInputT = {
  sheetsRead: number
  failures: readonly SheetParseFailureT[]
  candidates: readonly CandidateT[]
  skipped: number
  totalKeys: number
  similar: readonly SimilarPairT[]
}

function unitLines(candidates: readonly CandidateT[]): string[] {
  const counts = new Map<string, number>()
  for (const candidate of candidates) {
    const folded = foldUnit(candidate.unit)
    if (folded === '' || KNOWN_UNITS.includes(folded)) continue
    counts.set(candidate.unit, (counts.get(candidate.unit) ?? 0) + 1)
  }
  return Array.from(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([unit, count]) => `- „${unit}" — ${count} poz.`)
}

function candidateBlock(candidate: CandidateT): string {
  const [winner] = candidate.occurrences
  const prices = candidate.occurrences.map((occurrence) => occurrence.clientPrice)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const spread =
    min === max
      ? ''
      : `\n  rozrzut cen: ${money(min)}–${money(max)} (informacja przy weryfikacji, nie ocena)`
  const reason = RATE_REASON[winner.rateKind]

  return [
    `- ${candidate.rawDescription} [${candidate.unit || 'bez j.m.'}]`,
    `  kategoria: ${candidate.category ?? 'brak'}`,
    `  cena: ${money(candidate.clientPrice)} — arkusz „${winner.sheetName}"${
      winner.investmentName ? ` (${winner.investmentName})` : ''
    }`,
    `  stawki: z narzędziami ${rate(candidate.wToolsRate)}, bez narzędzi ${rate(
      candidate.ownToolsRate,
    )}${reason ? ` — ${reason}` : ''}`,
    `  wystąpień: ${candidate.occurrences.length}${spread}`,
  ].join('\n')
}

/** Cały przebieg B w jednym pliku do przejrzenia przed wsadem. */
export function buildReport(input: ReportInputT): string {
  const { sheetsRead, failures, candidates, skipped, totalKeys, similar } = input
  const units = unitLines(candidates)

  return [
    '# Import brakujących prac ze starych arkuszy — raport',
    '',
    '## 1. Podsumowanie',
    '',
    `- arkuszy przeczytanych: ${sheetsRead}`,
    `- arkuszy nieprzeczytanych: ${failures.length}`,
    `- unikalnych prac znalezionych w arkuszach: ${totalKeys}`,
    `- już w katalogu: ${skipped}`,
    `- do dołożenia: ${candidates.length}`,
    // Zero z cennika arkusza, nie z konfliktu — konflikt wychodzi jako „auto". To znaczy, że arkusz
    // naprawdę wycenił podwykonawcę na 0 zł, a katalog zamrozi tę kwotę; do sprawdzenia ręcznie.
    `- w tym ze stawką 0 zł z cennika arkusza: ${
      candidates.filter((c) => c.wToolsRate === 0 || c.ownToolsRate === 0).length
    }`,
    '',
    '## 2. Arkusze nieprzeczytane',
    '',
    failures.length === 0
      ? '- brak'
      : failures
          .map(
            (failure) =>
              `- ${failure.sheetName}${failure.investmentName ? ` (${failure.investmentName})` : ''} — ${failure.reason}`,
          )
          .join('\n'),
    '',
    '## 3. Prace do dołożenia',
    '',
    candidates.length === 0 ? '- brak' : candidates.map(candidateBlock).join('\n\n'),
    '',
    '## 4. Podejrzane jednostki miary',
    '',
    units.length === 0 ? '- brak' : units.join('\n'),
    '',
    '## 5. Kandydaci na duplikaty nazw',
    '',
    similar.length === 0
      ? '- brak'
      : similar
          .map(
            (pair) =>
              `- ${pair.score.toFixed(2)} · ${named(pair.left)} ↔ ${named(pair.right)} (${pair.side})`,
          )
          .join('\n'),
    '',
  ].join('\n')
}
