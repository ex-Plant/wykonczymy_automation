'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SectionHeaderFigureT = {
  itemCount: number
}

// What every band cell needs, carried on the wrapped column's `columnData` (never a closure — see
// kosztorys-synthetic-rows.tsx). Figures are keyed by section id because the band row carries only
// the section's identity, not its count. `onRename` is absent in the read-only client view, which
// is what freezes the name. Every other section command lives in the row „…" menu, not here.
export type SectionHeaderContextT = {
  figures: Map<number, SectionHeaderFigureT>
  collapsedSectionIds: ReadonlySet<number>
  onToggleCollapsed: (sectionId: number) => void
  onRename?: (sectionId: number, name: string) => void
}

// Which piece of the band this column paints. The band spans no columns, and the header carries only
// identity — the money moved to the closing footer band, where each figure sits under its own column
// instead of trailing the section name out of context.
export type SectionHeaderSlotT = 'label' | 'blank'

export function sectionHeaderSlot(columnId: string | undefined): SectionHeaderSlotT {
  return columnId === 'description' ? 'label' : 'blank'
}

// The dot reads `--section-rail` off the row (set by rowClassName from the section's palette entry),
// so the band's colour and the gutter rail can't disagree.
function SectionDot() {
  return (
    <span className="size-2.5 shrink-0 rounded-full bg-(--section-rail,var(--color-muted-foreground))" />
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
  const { onRename } = context

  if (slot === 'label') {
    const collapsed = context.collapsedSectionIds.has(rowData.sectionId)
    const Chevron = collapsed ? ChevronRight : ChevronDown
    return (
      // The whole band (not just the chevron) is the toggle target — rename stays reachable by
      // stopping its own click from bubbling here.
      <div
        role="button"
        tabIndex={0}
        title={collapsed ? 'Rozwiń sekcję' : 'Zwiń sekcję'}
        aria-expanded={!collapsed}
        onClick={() => context.onToggleCollapsed(rowData.sectionId)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          context.onToggleCollapsed(rowData.sectionId)
        }}
        className="hover:bg-accent/50 flex size-full cursor-pointer items-center gap-2 px-2 text-lg font-semibold"
      >
        <SectionDot />
        {onRename ? (
          <SectionNameCell
            rowData={rowData}
            onRename={onRename}
            // `field-sizing-content` (not w-fit) is what makes the input hug its value — an input's
            // fit-content is its ~20-character default width, so w-fit clipped long names and left
            // the chevron floating mid-cell. w-auto is needed to beat the base cell's w-full.
            className="field-sizing-content w-auto max-w-full min-w-0 px-0 text-lg font-semibold"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 truncate">{rowData.sectionName ?? ''}</span>
        )}
        <span className="text-muted-foreground shrink-0 text-sm font-normal">
          ({figure?.itemCount ?? 0} poz.)
        </span>
        <Chevron className="text-muted-foreground size-4 shrink-0" />
      </div>
    )
  }

  return <div className="size-full" />
}
