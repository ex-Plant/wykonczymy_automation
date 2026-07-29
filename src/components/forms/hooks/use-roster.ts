import { useEffect, useState } from 'react'
import { toastMessage } from '@/lib/utils/toast'
import {
  getSubcontractorRoster,
  type SubcontractorRosterT,
} from '@/lib/queries/subcontractor-roster'

type StateT = {
  // The investment the two fields below describe. Carried in state so a key change can be reconciled
  // during render rather than by a clearing effect, which would paint one frame of the previous
  // investment's roster before wiping it.
  key: string | null
  roster: SubcontractorRosterT | null
  isLoading: boolean
}

// Keyed by investment id rather than fired from the picker's onChange, because the two states that
// matter most set the field without anyone picking: a restored draft that mounts already
// PAYOUT + investment, and a reset that re-applies the URL-prefilled investment. Both would leave the
// block mounted with nothing in it. A null key means „nothing to show" — not a PAYOUT, or no
// investment — which also covers every reset path without a second entry point.
//
// `roster === null` is deliberately NOT an empty roster, which would be a lie.
export function useRoster(investmentId: string | null) {
  const [state, setState] = useState<StateT>({ key: null, roster: null, isLoading: false })

  if (state.key !== investmentId) {
    setState({ key: investmentId, roster: null, isLoading: Boolean(investmentId) })
  }

  useEffect(() => {
    if (!investmentId) return

    // Cleanup disowns a fetch the user has already navigated past, so a slow earlier response can
    // never overwrite a newer one — or toast a failure over a roster that has since loaded fine.
    let cancelled = false
    getSubcontractorRoster(Number(investmentId))
      .then((roster) => {
        if (!cancelled) setState({ key: investmentId, roster, isLoading: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ key: investmentId, roster: null, isLoading: false })
        toastMessage('Nie udało się pobrać rozliczenia pracowników', 'error')
      })

    return () => {
      cancelled = true
    }
  }, [investmentId])

  return { roster: state.roster, isRosterLoading: state.isLoading }
}
