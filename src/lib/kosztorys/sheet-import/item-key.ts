import type { KosztorysItemT } from '@/lib/kosztorys/types'
import { TYPO_FIXES } from '@/lib/kosztorys/clean-description'
import { fold } from './columns'

// „Popraw literówki w opisie prac" rewrites LETTERS, and `fold()` — case, diacritics, whitespace —
// cannot absorb that. Without this the cleaner silently costs every praca it touches its identity:
// it stops matching its twin in the sheet, so the compare dialog reports it as a difference and the
// import treats it as a praca the sheet doesn't have. Applying the same fixes here is what makes the
// two sides converge whether or not anyone has run the cleaner.
//
// The rules are folded rather than the text run through `cleanDescription`: that function fixes
// spelling BEFORE it un-shouts, so a SHOUTED opis never matches a fix written in lowercase and the
// two sides would diverge on case alone — the one thing `fold()` had already solved. Folding both
// the text and the rules sidesteps the ordering entirely, and drops the rules that only ever
// corrected diacritics (`farba silikonowa` → `farbą silikonową`), which folding equates anyway.
const FOLDED_TYPO_FIXES = TYPO_FIXES.map(([from, to]) => [fold(from), fold(to)] as const).filter(
  ([from, to]) => from !== to,
)

function foldDescription(description: string | null): string {
  return FOLDED_TYPO_FIXES.reduce(
    (text, [from, to]) => text.split(from).join(to),
    fold(description),
  )
}

// The praca's identity across a re-import: which section it sits in, what it is called, and which
// repetition of that name it is. Ids can't do this job — the sheet has none — and the row number
// can't either, since inserting one praca would re-key every praca below it.
export const itemKey = (section: string, description: string | null, occurrence: number): string =>
  `${fold(section)}|${foldDescription(description)}#${occurrence}`

export function keyItems(
  items: readonly KosztorysItemT[],
  sectionName: (item: KosztorysItemT) => string,
): Map<string, KosztorysItemT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, KosztorysItemT>()
  for (const item of items) {
    const section = sectionName(item)
    const base = `${fold(section)}|${foldDescription(item.description)}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    byKey.set(itemKey(section, item.description, occurrence), item)
  }
  return byKey
}
