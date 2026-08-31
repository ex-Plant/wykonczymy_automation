'use client'

import { listWorkCatalogueAction } from '@/lib/actions/work-catalogue'
import { useListOnOpen } from '@/components/kosztorys/editor/dialogs/use-list-on-open'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

export function useWorkCatalogue(open: boolean) {
  const { items, reset } = useListOnOpen<WorkCatalogueItemT>(
    open,
    listWorkCatalogueAction,
    'Nie udało się wczytać katalogu prac',
  )
  return { catalogue: items, resetCatalogue: reset }
}
