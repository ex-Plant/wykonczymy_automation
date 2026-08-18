'use client'

import {
  FIGURE_OPTIONS,
  useMarginFigure,
  useMarginPlane,
} from '@/components/kosztorys/summary/hooks/use-margin-reading'
import { MarginActualTable } from '@/components/kosztorys/summary/tabs/margin-actual-table'
import { MarginForecastTable } from '@/components/kosztorys/summary/tabs/margin-forecast-table'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import { financialsOnReading, type SummaryReadingT } from '@/lib/kosztorys/summary-reading'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

type PropsT = {
  financials: InvestmentFinancialsT
  subcontractor: SubcontractorSettlementT
  // Both scenarios priced up front, because the plane toggle below is local UI state: handing the
  // panel one forecast would make the toggle need the whole row set to price the other half. A host
  // with no rows (the investment page) omits this entirely and renders the actual margin alone.
  forecastByPlane?: Record<ToolPlaneT, MarginForecastT>
} & SummaryReadingT

// Company-plane figures. Visibility is enforced upstream by the host omitting `financials` for anyone
// but ADMIN/OWNER, which keeps the numbers out of the RSC payload rather than merely off the screen —
// so this component carries no role check of its own.
//
// Robocizna and rabat arrive as the reading the host resolved, not off `financials`: the block above
// this tab is already on that plane, and a tab reading the transactions figures made the same panel
// report two different robocizny. Materiały wliczone w robociznę and strata stay `financials`-sourced
// — the kosztorys knows about neither.
export function SummaryMarginTab({
  financials,
  laborCostsNet,
  discountAmount,
  subcontractor,
  forecastByPlane,
}: PropsT) {
  const [figure, setFigure] = useMarginFigure()
  const [plane, setPlane] = useMarginPlane()

  const forecast = forecastByPlane?.[plane]

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Only offered where both figures exist — a one-option toggle would suggest a second reading
          this host does not have. */}
      {forecastByPlane && (
        <div className="w-fit">
          <ToggleGroup
            options={FIGURE_OPTIONS}
            value={figure}
            onChange={setFigure}
            aria-label="Która marża"
          />
        </div>
      )}

      {figure === 'forecast' && forecast ? (
        <MarginForecastTable forecast={forecast} plane={plane} onPlaneChange={setPlane} />
      ) : (
        <MarginActualTable
          financials={financialsOnReading(financials, { laborCostsNet, discountAmount })}
          subcontractor={subcontractor}
        />
      )}
    </div>
  )
}
