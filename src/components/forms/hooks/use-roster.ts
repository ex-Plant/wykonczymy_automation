import { useRef, useState } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import {
  getSubcontractorRoster,
  type SubcontractorRosterT,
} from '@/lib/queries/subcontractor-roster'

// Mirrors `useSaldo`: on-demand fetch keyed by a monotonic request id, so a fast re-pick can never
// let a slower earlier response win. `roster === null` means "nothing to show" — no investment
// picked, or the fetch failed — and is deliberately NOT an empty roster, which would read as
// „nikt nic nie ma" and be a lie.
//
// Idempotent by investment id rather than fire-on-every-change, because two fields load it: the
// investment picker (the selection changed) and the worker picker (the investment may have been
// pre-filled from the URL and never picked at all). Without the guard the second would refetch what
// the first already has, and flash a spinner over figures that were already correct.
export function useRoster() {
  const [roster, setRoster] = useState<SubcontractorRosterT | null>(null)
  const [isRosterLoading, setIsRosterLoading] = useState(false)
  const requestRef = useRef(0)
  const loadedForRef = useRef<string | null>(null)

  async function loadRoster(investmentId: string) {
    if (investmentId === loadedForRef.current) return
    loadedForRef.current = investmentId || null
    setRoster(null)
    if (!investmentId) return

    const requestId = ++requestRef.current
    setIsRosterLoading(true)
    try {
      const result = await getSubcontractorRoster(Number(investmentId))
      if (requestRef.current === requestId) setRoster(result)
    } catch {
      // A failed load must not leave the id marked as loaded, or the retry path (re-picking the same
      // investment) silently no-ops and the user is stuck with no roster and no way to ask again.
      if (requestRef.current === requestId) {
        loadedForRef.current = null
        // Inside the guard with the rest: a superseded request that fails must not toast over the
        // roster a newer request has already loaded fine.
        toastMessage('Nie udało się pobrać rozliczenia pracowników', 'error')
      }
    } finally {
      if (requestRef.current === requestId) setIsRosterLoading(false)
    }
  }

  function resetRoster() {
    // Bump the id too — a reset must also disown a fetch still in flight, or its response repopulates
    // a roster for the investment the user has just cleared.
    requestRef.current++
    loadedForRef.current = null
    setRoster(null)
    // Lower the flag here rather than leaving it to the disowned request's `finally`, which now
    // no-ops against the bumped id: without this the spinner is stranded on and the panel reads
    // „Wczytywanie rozliczenia…" forever.
    setIsRosterLoading(false)
  }

  return { roster, isRosterLoading, loadRoster, resetRoster }
}
