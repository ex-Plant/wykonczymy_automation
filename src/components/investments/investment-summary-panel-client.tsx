'use client'

import { useRouter } from 'next/navigation'
import { useState, type ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { updateInvestmentSettlementModeAction } from '@/lib/actions/kosztorys'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { SummaryReadingT } from '@/lib/kosztorys/summary-reading'
import { toastMessage } from '@/lib/utils/toast'

// Robocizna (etapy) and Podwykonawcy stay editor-only: the first needs the stage grid to make sense,
// the second is a company-plane figure that has no place next to the client settlement.
const INVESTMENT_PANEL_VIEWS: SummaryViewT[] = ['summary', 'wydatki', 'wplaty']

type VersionT = 'v1' | 'v2'

const VERSION_OPTIONS: OptionT<VersionT>[] = [
  { value: 'v1', label: 'v1' },
  { value: 'v2', label: 'v2' },
]

const VERSION_TOOLTIP =
  'v1 — robocizna i rabat z transakcji (tak jak dotychczas).\n' +
  'v2 — robocizna i rabat wyliczone z kosztorysu (ceny klienta, netto); ' +
  'bilans i marża liczone tym samym wzorem, tylko z tych wartości.\n' +
  'Materiały, wpłaty, wypłaty i strata w obu wersjach pochodzą z transakcji.'

type PropsT = Omit<
  ComponentProps<typeof SummaryPanelContent>,
  | 'onSettlementModeChange'
  | 'views'
  | 'showSettingsBar'
  | 'showTransactionLists'
  | 'topBarSlot'
  | keyof SummaryReadingT
> & {
  fromTransactions: SummaryReadingT
  // Absent = the investment has no kosztorys rows, so there is no second reading and no toggle.
  fromKosztorys?: SummaryReadingT
}

// The investment page's host for the summary panel. Owns the two things the server page can't: the
// settlement-mode write, and the v1/v2 reading switch (a verification affordance the owner reaches
// for while the two planes are still being reconciled — deliberately not persisted).
export function InvestmentSummaryPanelClient({
  fromTransactions,
  fromKosztorys,
  ...props
}: PropsT) {
  const router = useRouter()
  const [version, setVersion] = useState<VersionT>('v2')

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

  const reading = version === 'v2' && fromKosztorys ? fromKosztorys : fromTransactions

  return (
    <SummaryPanelContent
      {...props}
      {...reading}
      onSettlementModeChange={handleSettlementModeChange}
      views={INVESTMENT_PANEL_VIEWS}
      showTransactionLists={false}
      topBarSlot={
        fromKosztorys ? (
          <div className="flex items-center gap-1">
            <ToggleGroup
              options={VERSION_OPTIONS}
              value={version}
              onChange={setVersion}
              aria-label="Źródło robocizny i rabatu"
            />
            <InfoTooltip content={VERSION_TOOLTIP} label="Czym różnią się v1 i v2" />
          </div>
        ) : undefined
      }
    />
  )
}
