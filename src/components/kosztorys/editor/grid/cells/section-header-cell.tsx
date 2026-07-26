'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import { KosztorysSectionActionsMenu } from '@/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu'
import { formatNet } from '@/lib/kosztorys/format'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SectionHeaderFigureT = {
  net: number
  gross: number
  itemCount: number
}

// Taking the section as an argument rather than pre-bound: the context is built once per grid, while
// a band binds them to its own section at render.
export type SectionHeaderHandlersT = {
  onInsert: (sectionId: number, dir: 'above' | 'below') => void
  onReorder: (sectionId: number, dir: 'up' | 'down') => void
  onSetColor: (sectionId: number, color: SectionColorKeyT | null) => void
  onRemove: (sectionId: number) => void
  onRename: (sectionId: number, name: string) => void
}

// What every band cell needs, carried on the wrapped column's `columnData` (never a closure — see
// kosztorys-synthetic-rows.tsx). Figures are keyed by section id because the band row carries only
// the section's identity, not its numbers. `handlers` is absent in the read-only client view, which
// is what hides the menu and freezes the name.
export type SectionHeaderContextT = {
  figures: Map<number, SectionHeaderFigureT>
  collapsedSectionIds: ReadonlySet<number>
  onToggleCollapsed: (sectionId: number) => void
  handlers?: SectionHeaderHandlersT
}

// Which piece of the band this column paints. The band spans no columns — each cell renders its own
// piece under the column it sits in, so dsg's layout keeps the figure aligned with „Razem netto"
// through horizontal scroll.
export type SectionHeaderSlotT = 'label' | 'net' | 'gross' | 'actions' | 'blank'

export function sectionHeaderSlot(columnId: string | undefined): SectionHeaderSlotT {
  if (columnId === 'description') return 'label'
  if (columnId === 'net') return 'net'
  if (columnId === 'gross') return 'gross'
  if (columnId === 'actions') return 'actions'
  return 'blank'
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
  const { handlers } = context

  if (slot === 'label') {
    const collapsed = context.collapsedSectionIds.has(rowData.sectionId)
    const Chevron = collapsed ? ChevronRight : ChevronDown
    return (
      <div className="flex size-full items-center gap-2 px-2 text-base font-semibold">
        <button
          type="button"
          title={collapsed ? 'Rozwiń sekcję' : 'Zwiń sekcję'}
          aria-expanded={!collapsed}
          onClick={() => context.onToggleCollapsed(rowData.sectionId)}
          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
        >
          <Chevron className="size-4" />
        </button>
        <SectionDot />
        {handlers ? (
          <SectionNameCell
            rowData={rowData}
            onRename={handlers.onRename}
            className="min-w-0 flex-1 px-0 text-base font-semibold"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{rowData.sectionName ?? ''}</span>
        )}
        <span className="text-muted-foreground shrink-0 text-xs font-normal">
          {figure?.itemCount ?? 0} poz.
        </span>
      </div>
    )
  }

  if (slot === 'actions') {
    if (!handlers) return <div className="size-full" />
    return (
      <KosztorysSectionActionsMenu
        name={rowData.sectionName ?? ''}
        itemCount={figure?.itemCount ?? 0}
        color={rowData.sectionColor}
        actions={{
          onInsertAbove: () => handlers.onInsert(rowData.sectionId, 'above'),
          onInsertBelow: () => handlers.onInsert(rowData.sectionId, 'below'),
          onMoveUp: () => handlers.onReorder(rowData.sectionId, 'up'),
          onMoveDown: () => handlers.onReorder(rowData.sectionId, 'down'),
          onSetColor: (color) => handlers.onSetColor(rowData.sectionId, color),
          onRemove: () => handlers.onRemove(rowData.sectionId),
        }}
      />
    )
  }

  if (slot === 'blank' || figure == null) return <div className="size-full" />

  // Same weight and size as the „Razem" row's figures — both are totals, so they read at one glance.
  return (
    <div className="flex size-full items-center px-2 text-base font-semibold tabular-nums">
      {formatNet(slot === 'net' ? figure.net : figure.gross)}
    </div>
  )
}
