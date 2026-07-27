'use client'

import type { ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'
import {
  updateInvestmentMaterialsNetRateAction,
  updateInvestmentSettlementModeAction,
} from '@/lib/actions/kosztorys'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { toastMessage } from '@/lib/utils/toast'

// Robocizna (etapy) stays editor-only — it needs the stage grid to make sense. Wpłaty and
// Podwykonawcy are dropped for the opposite reason: the transfers table below this panel already
// lists every deposit and every wypłata. Marża renders only when the page hands the panel `financials`, which it does for ADMIN/OWNER only.
const INVESTMENT_PANEL_VIEWS: SummaryViewT[] = ['summary', 'wydatki', 'margin']

type PropsT = Omit<
  ComponentProps<typeof SummaryPanelContent>,
  | 'onSettlementModeChange'
  | 'onMaterialsNetRateChange'
  | 'views'
  | 'showSettingsBar'
  | 'showTransactionLists'
  | 'showPies'
>

// The investment page's host for the summary panel. Exists to own the settlement-mode write: the
// panel offers the control, but persisting it is a client concern the server page can't hold.
export function InvestmentSummaryPanelClient(props: PropsT) {
  // No router.refresh() on success: the action's `updateTag` already re-renders this route and
  // streams the fresh tree back in the action response, so refreshing asked the server for the same
  // page a second time — a full duplicate render per click, measured in the EX-597 baseline.
  async function handleSettlementModeChange(mode: SettlementModeT) {
    const result = await updateInvestmentSettlementModeAction(props.investmentId, mode)
    if (!result.success) toastMessage(result.error, 'warning', 4000)
  }

  async function handleMaterialsNetRateChange(rate: number | null) {
    const result = await updateInvestmentMaterialsNetRateAction(props.investmentId, rate)
    if (!result.success) toastMessage(result.error, 'warning', 4000)
  }

  return (
    <SummaryPanelContent
      {...props}
      onSettlementModeChange={handleSettlementModeChange}
      onMaterialsNetRateChange={handleMaterialsNetRateChange}
      views={INVESTMENT_PANEL_VIEWS}
      showTransactionLists={false}
      showPies={false}
    />
  )
}
