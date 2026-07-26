'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import { formatNet } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SectionHeaderFigureT = {
  net: number
  gross: number
  itemCount: number
}

// What every band cell needs, carried on the wrapped column's `columnData` (never a closure — see
// kosztorys-synthetic-rows.tsx). Figures are keyed by section id because the band row carries only
// the section's identity, not its numbers. `onRename` is absent in the read-only client view, which
// is what freezes the name. Every other section command lives in the row „…" menu, not here.
export type SectionHeaderContextT = {
  figures: Map<number, SectionHeaderFigureT>
  collapsedSectionIds: ReadonlySet<number>
  onToggleCollapsed: (sectionId: number) => void
  // Which of the section's two figures the label carries — the money columns themselves are hidden
  // per axis, so the band has to be told rather than infer it from the column it sits in.
  moneyAxis: MoneyAxisT
  onRename?: (sectionId: number, name: string) => void
}

// Which piece of the band this column paints. The band spans no columns — each cell renders its own
// piece under the column it sits in, which is why the money sits in the label slot: unlike „Razem",
// whose figures line up under their own columns, the band's total belongs to the section name and
// stays readable without scrolling right to find it.
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

// Out of its own column the bare number would be ambiguous, so each figure names its plane. 'none'
// never reaches here (the editor maps it to 'both'), but it must still resolve to no figure rather
// than a wrong one.
function bandMoney(figure: SectionHeaderFigureT, axis: MoneyAxisT): string {
  const parts: string[] = []
  if (axis === 'net' || axis === 'both') parts.push(`${formatNet(figure.net)} netto`)
  if (axis === 'gross' || axis === 'both') parts.push(`${formatNet(figure.gross)} brutto`)
  return parts.join(' · ')
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
        {/* The chevron is the fold affordance, so it sits against the name it folds; the money takes
            the slack instead (ml-auto). */}
        <Chevron className="text-muted-foreground size-4 shrink-0" />
        {figure && (
          <span className="ml-auto shrink-0 text-base tabular-nums">
            {bandMoney(figure, context.moneyAxis)}
          </span>
        )}
      </div>
    )
  }

  return <div className="size-full" />
}
