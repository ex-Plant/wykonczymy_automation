'use client'

import { type ReactNode } from 'react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieSliceLegend, type PieSliceT } from '@/components/ui/pie-legend'

// Shared skeleton for the footer pies: recharts donut + legend. `description` is an optional note
// for a pie whose figures need their derivation spelled out, and `action` an optional control above
// it — both sit above the chart, so the base is picked and the derivation read before the numbers,
// not offered as a footnote after them. `formatValue` renders slice
// figures in the tooltip and legend — the caller owns units/locale, so this stays domain-free.
export function SlicePie({
  caption,
  action,
  slices,
  formatValue,
  description,
}: {
  caption: string
  action?: ReactNode
  slices: PieSliceT[]
  formatValue: (value: number) => string
  description?: ReactNode
}) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption>
        <span className="text-muted-foreground mr-4 text-xs">{caption}</span>
        {action}
      </figcaption>
      {description}
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
      <PieSliceLegend slices={slices} formatValue={formatValue} />
    </figure>
  )
}
