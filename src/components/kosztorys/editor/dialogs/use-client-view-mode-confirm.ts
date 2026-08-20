'use client'

import { useInvestorImpactConfirm } from '@/components/kosztorys/editor/hooks/use-investor-impact-confirm'
import { CLIENT_VIEW_MODE_IMPACT } from '@/lib/kosztorys/investor-impact'
import type { ClientViewConfigT } from '@/lib/kosztorys/client-view-settings'

/**
 * The variant flip raises the same window as the two trybs rozliczenia, for the same reason: the
 * settings window does not show what the client's link currently serves. Shared by both dialogs that
 * host the form, so the wording and the flow stay one.
 *
 * Only the flip asks. Re-ticking columns inside the active variant changes what the client sees too,
 * but a dialog on every tick trains the owner to click through it.
 */
export function useClientViewModeConfirm(saved: ClientViewConfigT | null) {
  const { stageInvestorImpact, investorImpactConfirm } = useInvestorImpactConfirm()

  const confirmModeChange = (draft: ClientViewConfigT, run: () => void) => {
    if (saved && draft.mode !== saved.mode) {
      return stageInvestorImpact(CLIENT_VIEW_MODE_IMPACT[draft.mode], run)
    }
    run()
  }

  return { confirmModeChange, modeConfirmProps: investorImpactConfirm }
}
