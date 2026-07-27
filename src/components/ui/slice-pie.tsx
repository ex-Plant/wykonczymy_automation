'use client'

import { type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieSliceLegend, type PieSliceT } from '@/components/ui/pie-legend'

// Shared skeleton for the footer pies: recharts donut + legend. `caption` is optional — the legend
// names every slice and the surrounding tab supplies the context, so a pie only titles itself when it
// carries an `action` the title has to explain. `description` is an optional note for a pie whose
// figures need their derivation spelled out; both it and `action` sit above the chart, so the base is
// picked and the derivation read before the numbers, not offered as a footnote after them.
// `formatValue` renders slice figures in the tooltip and legend — the caller owns units/locale, so
// this stays domain-free.
export function SlicePie({
  caption,
  action,
  slices,
  formatValue,
  description,
}: {
  caption?: string
  action?: ReactNode
  slices: PieSliceT[]
  formatValue: (value: number) => string
  description?: ReactNode
}) {
  // recharts derives each wedge's angle from value / totalSum. A negative total (one slice far
  // outweighing the rest, e.g. a mistyped section figure) makes that math degenerate and the pie
  // renders nothing — indistinguishable from "no data" unless we call out the bad total explicitly.
  // Zero is a legitimate default (no figures yet, or a balanced cancel-out) — only negative is a mistake.
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const isInvalidTotal = slices.length > 0 && total < 0

  return (
    <figure className="flex flex-col gap-3">
      {(caption || action) && (
        <figcaption>
          {caption && <span className="text-muted-foreground mr-4 text-xs">{caption}</span>}
          {action}
        </figcaption>
      )}
      {description}
      {isInvalidTotal ? (
        <div className="text-destructive mx-auto flex h-40 w-40 flex-col items-center justify-center gap-2 text-center text-xs">
          <AlertTriangle className="size-5" />
          <span>Błędne dane: suma wartości jest ujemna.</span>
        </div>
      ) : (
        <ChartContainer className="mx-auto h-40 w-40">
          <PieChart>
            {/* Each summary tab mounts fresh on switch, so the default intro sweep would replay on every
                tab change — off, since the pie is a static readout, not a transition. */}
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              strokeWidth={1}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={<ChartTooltipContent valueFormatter={(v) => formatValue(Number(v))} />}
            />
          </PieChart>
        </ChartContainer>
      )}
      <PieSliceLegend slices={slices} formatValue={formatValue} />
    </figure>
  )
}
