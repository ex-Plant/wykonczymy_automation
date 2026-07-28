import { useMemo, useState } from 'react'
import { foldText } from '@/lib/utils/fold-text'

export function useSearchFilter<TItem>(data: TItem[], getSearchableText: (item: TItem) => string) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredData = useMemo(() => {
    // Fold rather than lowercase, so an ASCII query reaches a Polish label — the cmdk searches got
    // this via `foldFilter`; this hook's callers did not.
    const term = foldText(searchTerm.trim())
    if (!term) return data

    return data.filter((item) => foldText(getSearchableText(item)).includes(term))
  }, [data, searchTerm, getSearchableText])

  return { filteredData, searchTerm, setSearchTerm } as const
}
