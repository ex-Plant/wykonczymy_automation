'use client'

import { useEffect, useState } from 'react'
import { listWorkCatalogueAction } from '@/lib/actions/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać katalogu prac'

// Fetch-on-open, the same contract as `usePresetSections`: `null` = not yet loaded, distinct from
// `[]` = loaded-but-empty, so „Katalog prac jest pusty" never flashes mid-fetch. Resetting to `null`
// is the CALLER's job, in its own close handler.
export function useWorkCatalogue(open: boolean) {
  const [catalogue, setCatalogue] = useState<WorkCatalogueItemT[] | null>(null)

  useEffect(() => {
    if (!open) return
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      setCatalogue([])
      toastMessage(message, 'error', 4000)
    }
    void listWorkCatalogueAction()
      .then((res) => {
        if (stale) return
        if (res.success) setCatalogue(res.data)
        else fail(res.error ?? LOAD_FAILED)
      })
      // A transport-level RPC rejection never resolves to {success:false}; without this the loading
      // line hangs forever on a dropped request.
      .catch(() => fail(LOAD_FAILED))
    return () => {
      stale = true
    }
  }, [open])

  return { catalogue, resetCatalogue: () => setCatalogue(null) }
}
