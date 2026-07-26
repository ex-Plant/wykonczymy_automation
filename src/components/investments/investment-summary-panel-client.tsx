'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'
import { updateInvestmentSettlementModeAction } from '@/lib/actions/kosztorys'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { toastMessage } from '@/lib/utils/toast'

// Robocizna (etapy) stays editor-only — it needs the stage grid to make sense.
const INVESTMENT_PANEL_VIEWS: SummaryViewT[] = ['summary', 'wydatki', 'wplaty', 'podwykonawcy']

type PropsT = Omit<
  ComponentProps<typeof SummaryPanelContent>,
  'onSettlementModeChange' | 'views' | 'showSettingsBar' | 'showTransactionLists' | 'showPies'
>

// The investment page's host for the summary panel. Exists to own the settlement-mode write: the
// panel offers the control, but persisting it is a client concern the server page can't hold.
export function InvestmentSummaryPanelClient(props: PropsT) {
  const router = useRouter()

  async function handleSettlementModeChange(mode: SettlementModeT) {
    const result = await updateInvestmentSettlementModeAction(props.investmentId, mode)
    if (!result.success) {
      toastMessage(result.error, 'warning', 4000)
      return
    }
    // The mode is read straight off the server prop (no optimistic copy), so the refresh IS the
    // update — same contract the editor's settings saves use.
    router.refresh()
  }

  return (
    <SummaryPanelContent
      {...props}
      onSettlementModeChange={handleSettlementModeChange}
      views={INVESTMENT_PANEL_VIEWS}
      showTransactionLists={false}
      showPies={false}
    />
  )
}
