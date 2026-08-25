'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
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
  // Which column paints the label — resolved per render off the visible order, never a fixed id.
  labelColumnId?: string
}

// dsg has no colspan, so the band is painted per column: one column carries the whole label, the
// rest paint blank.
export type SectionHeaderSlotT = 'label' | 'blank'

// Chrome, not a reading of the kosztorys: „Akcje" is 64px of row menu and the trailing gap is empty
// by definition, so neither can host a label that has to be legible. Literals rather than an import
// from the column assembly, which imports this file.
const CHROME_COLUMN_IDS: ReadonlySet<string> = new Set(['actions', 'layerGap'])

// The band follows the grid instead of a named column: no column holds a fixed slot any more
// (lib/kosztorys/column-order), so „Opis prac" can be dragged to the far right or hidden from the
// client entirely — either of which used to paint the band off-screen or not at all.
export function sectionBandLabelColumnId(
  columnIds: readonly (string | undefined)[],
): string | undefined {
  return columnIds.find((id): id is string => id != null && !CHROME_COLUMN_IDS.has(id))
}

export function sectionHeaderSlot(
  columnId: string | undefined,
  labelColumnId: string | undefined,
): SectionHeaderSlotT {
  return columnId != null && columnId === labelColumnId ? 'label' : 'blank'
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
        // `w-max`, not `w-full`: the band hugs its own content and is let out of the cell by theDda
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
            // `shrink-0` like every other item on the band: a field-sizing input doesn't report its
            // content width as a max-content contribution, so the band's `w-max` under-measures and
            // the flex line shrank the name back down („Prace dodatko") instead of overflowing.
            className="field-sizing-content w-auto shrink-0 px-0 text-lg font-semibold"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="shrink-0 whitespace-nowrap">{rowData.sectionName ?? ''}</span>
        )}
        <span className="text-muted-foreground shrink-0 text-sm font-normal">
          ({itemCount} poz.)
        </span>
        {/* „netto" spelled out: the grid carries a netto and a brutto reading of every money column,
            so a bare amount on the band leaves the reader guessing which one this is. */}
        {net !== 0 && (
          <span className="shrink-0 text-sm whitespace-nowrap">
            <span className="font-medium tabular-nums">{formatNet(net)} zł</span>
            <span className="text-muted-foreground font-normal"> netto</span>
          </span>
        )}
        <Chevron className="text-muted-foreground size-4 shrink-0" />
      </div>
    )
  }

  // The blank cells toggle too, so any point on the band row works — keyboard/aria stay on the label
  // cell alone, which is the one control.
  return <div aria-hidden title={title} onClick={toggle} className="size-full cursor-pointer" />
}
