'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import { IDENTITY_COLUMN_ID } from '@/lib/kosztorys/constants'
import { formatNet } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// What every band cell needs, carried on the wrapped column's `columnData` (never a closure — see
// kosztorys-synthetic-rows.tsx). `onRename` is absent in the read-only client view, which is what
// freezes the name. Every other section command lives in the row „…" menu, not here.
// `net` is the section's executed value after rabat, in the active price view — the same figure its
// footer's „Razem netto" shows, so a collapsed section still states what it is worth.
export type SectionHeaderFigureT = { itemCount: number; net: number }

export type SectionHeaderContextT = {
  // Per section id — the band row carries the section's identity, not its figures.
  figures: Map<number, SectionHeaderFigureT>
  collapsedSectionIds: ReadonlySet<number>
  onToggleCollapsed: (sectionId: number) => void
  onRename?: (sectionId: number, name: string) => void
}

// dsg has no colspan, so the band is painted per column: one column carries the whole label, the
// rest paint blank.
export type SectionHeaderSlotT = 'label' | 'blank'

export function sectionHeaderSlot(columnId: string | undefined): SectionHeaderSlotT {
  return columnId === IDENTITY_COLUMN_ID ? 'label' : 'blank'
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
  const { itemCount, net } = context.figures.get(rowData.sectionId) ?? { itemCount: 0, net: 0 }
  const { onRename } = context
  const collapsed = context.collapsedSectionIds.has(rowData.sectionId)
  const toggle = () => context.onToggleCollapsed(rowData.sectionId)
  const title = collapsed ? 'Rozwiń sekcję' : 'Zwiń sekcję'

  if (slot === 'label') {
    const Chevron = collapsed ? ChevronRight : ChevronDown
    return (
      // The whole band (not just the chevron) is the toggle target — rename stays reachable by
      // stopping its own click from bubbling here.
      <div
        role="button"
        tabIndex={0}
        title={title}
        aria-expanded={!collapsed}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle()
        }}
        // `w-max`, not `w-full`: the band hugs its own content and is let out of the cell by the
        // `overflow: visible` rule in globals.css, so the name stops being clipped at the „Sekcja"
        // column's width.
        className="hover:bg-accent/50 flex h-full w-max cursor-pointer items-center gap-2 px-2 text-lg font-semibold"
      >
        <SectionDot />
        {onRename ? (
          <SectionNameCell
            rowData={rowData}
            onRename={onRename}
            // `field-sizing-content` (not w-fit) is what makes the input hug its value — an input's
            // fit-content is its ~20-character default width, so w-fit clipped long names and left
            // the chevron floating mid-cell. w-auto is needed to beat the base cell's w-full.
            className="field-sizing-content w-auto min-w-0 px-0 text-lg font-semibold"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="whitespace-nowrap">{rowData.sectionName ?? ''}</span>
        )}
        <span className="text-muted-foreground shrink-0 text-sm font-normal">
          ({itemCount} poz.)
        </span>
        {/* „netto" spelled out: the grid carries a netto and a brutto reading of every money column,
            so a bare amount on the band leaves the reader guessing which one this is. */}
        <span className="shrink-0 text-sm whitespace-nowrap">
          <span className="text-muted-foreground font-normal">netto </span>
          <span className="font-medium tabular-nums">{formatNet(net)} zł</span>
        </span>
        <Chevron className="text-muted-foreground size-4 shrink-0" />
      </div>
    )
  }

  // The blank cells toggle too, so any point on the band row works — keyboard/aria stay on the label
  // cell alone, which is the one control.
  return <div aria-hidden title={title} onClick={toggle} className="size-full cursor-pointer" />
}
