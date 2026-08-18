'use client'

import { faceValue } from '@/lib/kosztorys/summary-economics'
import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import {
  useMarginFigure,
  useMarginPlane,
  type MarginFigureT,
} from '@/components/kosztorys/summary/hooks/use-margin-reading'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { PLANE_LABELS, SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/constants'
import { marginV2, type SubcontractorSettlementT } from '@/lib/kosztorys/margin-v2'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import { financialsOnReading, type SummaryReadingT } from '@/lib/kosztorys/summary-reading'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

const FIGURE_OPTIONS: OptionT<MarginFigureT>[] = [
  { value: 'forecast', label: 'Prognoza' },
  { value: 'actual', label: 'Marża rzeczywista' },
]

const HINTS = {
  // due: 'Wykonane etapy wycenione stawką ekipy, która je robi. Nie wypłaty — te idą własnym rytmem.',
  // settled: 'Materiały kupione przez firmę, wliczone w cenę robocizny. Nie obciążają inwestora.',
  // loss: 'Koszt pokrywany przez firmę — obniża jej marżę i dług inwestora.',
  // plannedNet: 'Przedmiar w cenie dla inwestora, przed rabatem.',
  plannedDue: 'Prognozowana kwota do zapłaty podwykonawcom.',
  overpaid:
    'Ekipa dostała więcej, niż jest warta wykonana praca — zaliczka przed robotą albo nieodhaczone etapy.',
} as const

// The two descriptions below are the only place in the app that says what separates these figures,
// so they are part of the feature, not decoration.
const FORECAST_DESCRIPTION =
  'Prognoza czyli przedmiar w cenie dla inwestora minus przedmiar w stawce wybranej ekipy. ' +
  'Liczy się z pełnej ceny bez rabatu, straty ani materiałów wliczonych w inwestycje.'

const ACTUAL_DESCRIPTION =
  'Robocizna minus rabat minus suma wykonanej pracy, minus ' +
  'materiał wliczony w robociznę i strata. Koszt podwykonawców liczony z kosztorysu, a nie z wypłat — ile zrobiono, nie ile do tej pory wypłacono.'

// Wider than the shared value track: this table carries a single amount column, so at the shared
// width the row reads as a long label with a stub pinned to it. The withheld state also puts a
// sentence where a number normally goes.
const COLS = `${SUMMARY_LABEL_COL} 17rem`

// The crew block stands next to the margin, not in it: the margin costs the work the kosztorys
// credits, wypłaty are cash timing. Without this the two numbers look like a contradiction.
const PAYOUT_GAP_DESCRIPTION =
  'Poza marżą — ile ekipa dostała względem wykonanej pracy. Marża liczy wykonaną pracę, nie wypłaty.'

const OVERPAID_LABEL = 'Nadpłata'

const WITHHELD_LABEL = 'Ustaw rozliczenie etapów'

const WITHHELD_NOTE =
  'Etapy z wykonaną pracą, ale bez rozliczenia (z narzędziami / bez narzędzi), nie wchodzą do kosztu ekipy. Dopóki ich nie ustawisz, marża wyszłaby zawyżona o nieznaną kwotę.'

type PropsT = {
  financials: InvestmentFinancialsT
  // The crew side of the actual margin — the amount plus the reason it may be short.
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

  const readFinancials = financialsOnReading(financials, { laborCostsNet, discountAmount })
  const { totalLaborCosts, totalDiscount, totalLoss, totalSettled, totalPayouts } = readFinancials
  const margin = marginV2(readFinancials, subcontractor)

  const forecast = forecastByPlane?.[plane]
  // Negative = the crew has been paid past the work the kosztorys credits them for.
  const remaining = subcontractor.due - totalPayouts

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
        <>
          <Description className="max-w-xl" size="xs">
            {FORECAST_DESCRIPTION}
          </Description>
          <SummaryTable cols={COLS} className="w-fit">
            <SummaryHeaderCell variant="label">Prognoza</SummaryHeaderCell>
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>

            <SummaryRow
              label="Wartość przedmiaru"
              line={faceValue(forecast.clientNet)}
              axis="net"
            />
            <SummaryRow
              label={`Należne podwykonawcom (stawka ${PLANE_LABELS[plane].toLowerCase()})`}
              hint={HINTS.plannedDue}
              line={faceValue(-forecast.subcontractorNet)}
              axis="net"
              discount
            />
            <SummaryRow
              label="Marża prognozowana"
              line={faceValue(forecast.margin)}
              axis="net"
              bold
              danger={forecast.margin < 0}
            />
          </SummaryTable>
          {/* Belongs to the forecast alone: the actual margin prices each etap at the plane the etap
              itself carries, so a scenario switch beside it would imply an effect it does not have. */}
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={plane === 'own_tools'}
              onCheckedChange={(state) => setPlane(state === true ? 'own_tools' : 'w_tools')}
            />
            {PLANE_LABELS.own_tools}
          </label>
        </>
      ) : (
        <>
          <Description className="max-w-xl" size="xs">
            {ACTUAL_DESCRIPTION}
          </Description>
          <SummaryTable cols={COLS} className="w-fit">
            <SummaryHeaderCell variant="label">Marża rzeczywista</SummaryHeaderCell>
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>

            <SummaryRow label="Robocizna" line={faceValue(totalLaborCosts)} axis="net" />
            {totalDiscount !== 0 && (
              <SummaryRow label="Rabat" line={faceValue(-totalDiscount)} axis="net" discount />
            )}
            {/* Named from the shared labels rather than a fresh string, so this row and the
                „Podwykonawcy" tab can never call one amount two things. */}
            <SummaryRow
              label={SUBCONTRACTOR_FIGURE_LABELS.due}
              line={faceValue(-subcontractor.due)}
              axis="net"
              discount
            />
            {totalSettled !== 0 && (
              <SummaryRow
                label="Materiały wliczone w robociznę"
                line={faceValue(-totalSettled)}
                axis="net"
                discount
              />
            )}
            {totalLoss !== 0 && (
              <SummaryRow label="Strata" line={faceValue(-totalLoss)} axis="net" discount />
            )}
            {margin === null ? (
              // No amount at all — a zero-cost crew is a false statement, not a missing one.
              <>
                <SummaryLabelCell weight="bold">Marża</SummaryLabelCell>
                <SummaryValueCell weight="bold" note={{ text: WITHHELD_NOTE, tone: 'error' }}>
                  {WITHHELD_LABEL}
                </SummaryValueCell>
              </>
            ) : (
              <SummaryRow
                label="Marża"
                line={faceValue(margin)}
                axis="net"
                bold
                danger={margin < 0}
              />
            )}
          </SummaryTable>
          {(subcontractor.due !== 0 || totalPayouts !== 0) && (
            <>
              <Description className="max-w-xl" size="xs">
                {PAYOUT_GAP_DESCRIPTION}
              </Description>
              <SummaryTable cols={COLS} className="w-fit">
                <SummaryHeaderCell variant="label">Rozliczenie z ekipą</SummaryHeaderCell>
                <SummaryHeaderCell>Kwota</SummaryHeaderCell>

                <SummaryRow
                  label={SUBCONTRACTOR_FIGURE_LABELS.due}
                  line={faceValue(subcontractor.due)}
                  axis="net"
                />
                <SummaryRow
                  label={SUBCONTRACTOR_FIGURE_LABELS.payouts}
                  line={faceValue(-totalPayouts)}
                  axis="net"
                  discount
                />
                <SummaryRow
                  label={remaining < 0 ? OVERPAID_LABEL : SUBCONTRACTOR_FIGURE_LABELS.remaining}
                  hint={remaining < 0 ? HINTS.overpaid : undefined}
                  line={faceValue(remaining < 0 ? -remaining : remaining)}
                  axis="net"
                  bold
                  danger={remaining < 0}
                />
              </SummaryTable>
            </>
          )}
        </>
      )}
    </div>
  )
}
