'use client'

import { useEffect, useRef, type ComponentProps } from 'react'
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
  // SPIKE (EX-597) — splits the dead interval between clicking a control and the figures changing.
  // The server-side [PERF] lines stop when the handler returns, which accounts for ~250ms of a gap
  // the owner reads as 1-2s; these three marks say whether the rest is the round-trip or the commit.
  const clickAt = useRef<number | null>(null)

  useEffect(() => {
    const t0 = clickAt.current
    if (t0 == null) return
    clickAt.current = null
    const commit = Math.round(performance.now() - t0)
    requestAnimationFrame(() =>
      console.log(
        `[PERF:client] panel props applied — commit ${commit}ms, painted ` +
          `${Math.round(performance.now() - t0)}ms after click`,
      ),
    )
  }, [props.settlementMode, props.materialsNetRate])

  // No router.refresh() on success: the action's `updateTag` already re-renders this route and
  // streams the fresh tree back in the action response, so refreshing asked the server for the same
  // page a second time — a full duplicate render per click, measured in the EX-597 baseline.
  async function handleSettlementModeChange(mode: SettlementModeT) {
    clickAt.current = performance.now()
    const t0 = clickAt.current
    const result = await updateInvestmentSettlementModeAction(props.investmentId, mode)
    console.log(
      `[PERF:client] settlementMode action resolved ${Math.round(performance.now() - t0)}ms`,
    )
    if (!result.success) toastMessage(result.error, 'warning', 4000)
  }

  async function handleMaterialsNetRateChange(rate: number | null) {
    clickAt.current = performance.now()
    const t0 = clickAt.current
    const result = await updateInvestmentMaterialsNetRateAction(props.investmentId, rate)
    console.log(
      `[PERF:client] materialsNetRate action resolved ${Math.round(performance.now() - t0)}ms`,
    )
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
