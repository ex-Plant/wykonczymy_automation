import type { KosztorysItemT } from '@/lib/kosztorys/types'
import { fold } from './columns'

// The praca's identity across a re-import: which section it sits in, what it is called, and which
// repetition of that name it is. Ids can't do this job — the sheet has none — and the row number
// can't either, since inserting one praca would re-key every praca below it.
export const itemKey = (section: string, description: string | null, occurrence: number): string =>
  `${fold(section)}|${fold(description)}#${occurrence}`

export function keyItems(
  items: readonly KosztorysItemT[],
  sectionName: (item: KosztorysItemT) => string,
): Map<string, KosztorysItemT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, KosztorysItemT>()
  for (const item of items) {
    const section = sectionName(item)
    const base = `${fold(section)}|${fold(item.description)}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    byKey.set(itemKey(section, item.description, occurrence), item)
  }
  return byKey
}
