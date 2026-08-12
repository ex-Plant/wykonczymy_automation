'use client'

import { useEffect, useState } from 'react'
import { listPresetSectionsAction } from '@/lib/actions/kosztorys-presets'
import type { PresetSectionMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać szablonów'

// Fetch-on-open for both preset pickers: they are opened programmatically (from the „Opcje" menu,
// bypassing Radix's own open trigger), so the `open` prop is the one reliable seam. `null` = not yet
// loaded, distinct from `[]` = loaded-but-empty, so the „Brak zapisanych szablonów" empty state never
// flashes mid-fetch and a failed load isn't mistaken for a genuinely empty library.
//
// Resetting to `null` is the CALLER's job, in its own close handler — a synchronous setState in an
// effect body is the cascading-render smell the lint forbids, and each dialog has other state to
// reset in the same place anyway.
export function usePresetSections(open: boolean) {
  const [sections, setSections] = useState<PresetSectionMetaT[] | null>(null)

  useEffect(() => {
    if (!open) return
    // A close-then-reopen while the first load is in flight would otherwise resolve into the reset
    // state — showing a stale list, or toasting an error at a dialog nobody is looking at.
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      setSections([])
      toastMessage(message, 'error', 4000)
    }
    void listPresetSectionsAction()
      .then((res) => {
        if (stale) return
        if (res.success) setSections(res.data)
        else fail(res.error ?? LOAD_FAILED)
      })
      // A transport-level RPC rejection never resolves to {success:false}; without this „Ładowanie
      // szablonów…" hangs forever on a dropped request.
      .catch(() => fail(LOAD_FAILED))
    return () => {
      stale = true
    }
  }, [open])

  return { sections, resetSections: () => setSections(null) }
}
