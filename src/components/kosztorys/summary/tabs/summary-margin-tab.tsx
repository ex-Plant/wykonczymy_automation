'use client'

import { useState } from 'react'
import { faceValue } from '@/lib/kosztorys/summary-economics'
import {
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { Description } from '@/components/ui/description'
import { PLANE_LABELS, SUBCONTRACTOR_FIGURE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'
import { marginV2, type SubcontractorSettlementT } from '@/lib/kosztorys/margin-v2'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import { financialsOnReading, type SummaryReadingT } from '@/lib/kosztorys/summary-reading'
import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

type FigureT = 'forecast' | 'actual'

const FIGURE_OPTIONS: OptionT<FigureT>[] = [
  { value: 'forecast', label: 'Prognoza' },
  { value: 'actual', label: 'Marża rzeczywista' },
]

const PLANE_OPTIONS: OptionT<ToolPlaneT>[] = TOOL_PLANES.map((plane) => ({
  value: plane,
  label: PLANE_LABELS[plane],
}))

const HINTS = {
  laborCosts: 'Kwota, którą inwestor płaci firmie za pracę. Podstawa marży.',
  discount: 'Rabat na robociznę — firma rezygnuje z części ceny.',
  due: 'Wykonane etapy wycenione stawką ekipy, która je robi. Nie wypłaty — te idą własnym rytmem.',
  settled: 'Materiały kupione przez firmę, wliczone w cenę robocizny. Nie obciążają inwestora.',
  loss: 'Koszt pokrywany przez firmę — obniża jej marżę i dług inwestora.',
  plannedNet: 'Cały przedmiar w cenie dla inwestora, przed rabatem.',
  plannedDue: 'Ten sam przedmiar wyceniony stawką wybranej ekipy.',
} as const

// The two descriptions below are the only place in the app that says what separates these figures,
// so they are part of the feature, not decoration.
const FORECAST_DESCRIPTION =
  'Cały przedmiar w cenie dla inwestora minus ten sam przedmiar w stawce wybranej ekipy. ' +
  'Scenariusz, nie prognoza w czasie: liczy się z pełnej ceny, bo rabatu nie daje się z góry, ' +
  'i nie zna ani straty, ani materiału wliczonego w robociznę.'

const FORECAST_MATERIAL_NOTE =
  'To marża przed materiałem. Na pozycjach, w których materiał siedzi w cenie j.m., przedmiar niesie ' +
  'przychód z materiału i żadnego jego kosztu — prognoza stoi o ten koszt wyżej niż marża rzeczywista ' +
  'i te dwie kwoty nie zejdą się nawet przy pełnym wykonaniu.'

const ACTUAL_DESCRIPTION =
  'Robocizna z kosztorysu minus rabat, minus praca należna podwykonawcom za wykonane etapy, minus ' +
  'materiał wliczony w robociznę i strata. Podwykonawcy liczeni z kosztorysu, a nie z wypłat — ' +
  'wypłata mówi, ile zapłacono, nie ile zrobiono.'

const WITHHELD_LABEL = 'Ustaw rozliczenie etapów'

const WITHHELD_NOTE =
  'Etapy z wykonaną pracą, ale bez rozliczenia (z narzędziami / bez narzędzi), nie wchodzą do kosztu ' +
  'ekipy. Dopóki ich nie ustawisz, marża wyszłaby zawyżona o nieznaną kwotę, więc nie ma jej tu wcale.'

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
  // Local state, deliberately not persisted: the `kosztorys-*` localStorage family is what the
  // client-share disclosure lock treats as client-writable, and neither pick is worth putting there.
  const [figure, setFigure] = useState<FigureT>(forecastByPlane ? 'forecast' : 'actual')
  const [plane, setPlane] = useState<ToolPlaneT>('w_tools')

  const readFinancials = financialsOnReading(financials, { laborCostsNet, discountAmount })
  const { totalLaborCosts, totalDiscount, totalLoss, totalSettled } = readFinancials
  const margin = marginV2(readFinancials, subcontractor)

  // No VAT plane: marża sums net amounts, so there is one „Kwota" track.
  const cols = summaryMoneyCols('net')
  const forecast = forecastByPlane?.[plane]

  return (
    <div className="flex w-fit flex-col gap-y-3">
      {/* Only offered where both figures exist — a one-option toggle would suggest a second reading
          this host does not have. */}
      {forecastByPlane && (
        <ToggleGroup
          options={FIGURE_OPTIONS}
          value={figure}
          onChange={setFigure}
          aria-label="Która marża"
        />
      )}

      {figure === 'forecast' && forecast ? (
        <>
          {/* Belongs to the forecast alone: the actual margin prices each etap at the plane the etap
              itself carries, so a scenario toggle beside it would imply an effect it does not have. */}
          <ToggleGroup
            options={PLANE_OPTIONS}
            value={plane}
            onChange={setPlane}
            aria-label="Scenariusz podwykonawcy"
          />
          <SummaryTable cols={cols} className="w-fit">
            <SummaryHeaderCell variant="label">Prognoza</SummaryHeaderCell>
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>

            <SummaryRow
              label="Wartość przedmiaru"
              hint={HINTS.plannedNet}
              line={faceValue(forecast.clientNet)}
              axis="net"
            />
            <SummaryRow
              label="Należne podwykonawcom (przedmiar)"
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
          <Description size="xs">{FORECAST_DESCRIPTION}</Description>
          <Description size="xs">{FORECAST_MATERIAL_NOTE}</Description>
        </>
      ) : (
        <>
          <SummaryTable cols={cols} className="w-fit">
            <SummaryHeaderCell variant="label">Marża rzeczywista</SummaryHeaderCell>
            <SummaryHeaderCell>Kwota</SummaryHeaderCell>

            <SummaryRow
              label="Robocizna"
              hint={HINTS.laborCosts}
              line={faceValue(totalLaborCosts)}
              axis="net"
            />
            {totalDiscount !== 0 && (
              <SummaryRow
                label="Rabat"
                hint={HINTS.discount}
                line={faceValue(-totalDiscount)}
                axis="net"
                discount
              />
            )}
            {/* Named from the shared labels rather than a fresh string, so this row and the
                „Podwykonawcy" tab can never call one amount two things. */}
            <SummaryRow
              label={SUBCONTRACTOR_FIGURE_LABELS.due}
              hint={HINTS.due}
              line={faceValue(-subcontractor.due)}
              axis="net"
              discount
            />
            {totalSettled !== 0 && (
              <SummaryRow
                label="Materiały wliczone w robociznę"
                hint={HINTS.settled}
                line={faceValue(-totalSettled)}
                axis="net"
                discount
              />
            )}
            {totalLoss !== 0 && (
              <SummaryRow
                label="Strata"
                hint={HINTS.loss}
                line={faceValue(-totalLoss)}
                axis="net"
                discount
              />
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
          <Description size="xs">{ACTUAL_DESCRIPTION}</Description>
        </>
      )}
    </div>
  )
}
