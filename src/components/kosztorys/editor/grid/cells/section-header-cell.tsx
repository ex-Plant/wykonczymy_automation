'use client'

import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SectionHeaderFigureT = {
  net: number
  gross: number
  itemCount: number
}

// What every band cell needs, carried on the wrapped column's `columnData` (never a closure — see
// kosztorys-synthetic-rows.tsx). Figures are keyed by section id because the band row carries only
// the section's identity, not its numbers.
export type SectionHeaderContextT = {
  figures: Map<number, SectionHeaderFigureT>
}

// Which piece of the band this column paints. The band spans no columns — each cell renders its own
// piece under the column it sits in, so dsg's layout keeps the figure aligned with „Razem netto"
// through horizontal scroll.
export type SectionHeaderSlotT = 'label' | 'net' | 'gross' | 'blank'

export function sectionHeaderSlot(columnId: string | undefined): SectionHeaderSlotT {
  if (columnId === 'description') return 'label'
  if (columnId === 'net') return 'net'
  if (columnId === 'gross') return 'gross'
  return 'blank'
}

// The dot reads `--section-rail` off the row (set by rowClassName from the section's palette entry),
// so the band's colour and the gutter rail can't disagree.
function SectionDot() {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: 'var(--section-rail, var(--color-muted-foreground))' }}
    />
  )
}

export function SectionHeaderCell({
  rowData,
  slot,
  context,
}: {
  rowData: KosztorysV2RowT
  slot: SectionHeaderSlotT
  context: SectionHeaderContextT
}) {
  const figure = context.figures.get(rowData.sectionId)

  if (slot === 'label') {
    return (
      <div className="flex size-full items-center gap-2 px-2 text-sm font-semibold">
        <SectionDot />
        <span className="truncate">{rowData.sectionName ?? ''}</span>
        <span className="text-muted-foreground shrink-0 text-xs font-normal">
          {figure?.itemCount ?? 0} poz.
        </span>
      </div>
    )
  }

  if (slot === 'blank' || figure == null) return <div className="size-full" />

  return (
    <div className="flex size-full items-center px-2 text-sm font-semibold tabular-nums">
      {formatNet(slot === 'net' ? figure.net : figure.gross)}
    </div>
  )
}
