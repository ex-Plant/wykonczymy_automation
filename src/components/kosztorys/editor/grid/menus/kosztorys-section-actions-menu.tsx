'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'

// The section menu hangs off the band, not off every item row — so no `sortActive` gate here: a
// column sort drops the bands entirely, and with them this menu.
export type SectionBandActionsT = {
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onSetColor: (color: SectionColorKeyT | null) => void
  onRemove: () => void
}

export function KosztorysSectionActionsMenu({
  name,
  itemCount,
  color,
  actions,
}: {
  name: string
  itemCount: number
  color: SectionColorKeyT | null
  actions: SectionBandActionsT
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        {/* Same cell-sized trigger as the row menu (see kosztorys-row-actions-menu.tsx): the chrome
            sits on an inner span so the whole cell stays clickable. */}
        <DropdownMenuTrigger
          title="Akcje sekcji"
          className="group flex size-full cursor-pointer items-center justify-center outline-none"
        >
          <span className="text-foreground group-hover:bg-accent group-hover:text-accent-foreground group-data-[state=open]:bg-accent flex size-6 items-center justify-center rounded-md transition-colors">
            <MoreHorizontal className="size-3.5" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem onSelect={actions.onInsertAbove}>
            <ArrowUpToLine />
            Wstaw powyżej
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onInsertBelow}>
            <ArrowDownToLine />
            Wstaw poniżej
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onMoveUp}>
            <ArrowUp />
            Przesuń w górę
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.onMoveDown}>
            <ArrowDown />
            Przesuń w dół
          </DropdownMenuItem>
          <SectionColorPicker value={color} onChange={actions.onSetColor} />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Usuń sekcję
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        title={`Usunąć sekcję „${name}"?`}
        description={`Usunie też ${itemCount} pozycji wraz z wpisanymi w nich ilościami etapów. Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        onConfirm={() => {
          actions.onRemove()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
