'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'

type PropsT = {
  // Insert + move have no meaning against a price-sorted view — disabled with a hint.
  sortActive: boolean
  // Why delete is blocked (only the empty-sheet floor now), or undefined if removable. Present →
  // delete disabled with the reason in a tooltip (disabled items are pointer-events-none, so a
  // native title never fires).
  removeBlockReason?: string
  // Populated row: delete destroys recorded stage progress, so route through a confirm dialog first.
  removeNeedsConfirm?: boolean
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  // Section-level actions, all keyed off the row's section. Absent (read-only view) → the whole
  // „Sekcje" group is hidden.
  onRemoveSection?: () => void
  onInsertSectionAbove?: () => void
  onInsertSectionBelow?: () => void
  onMoveSectionUp?: () => void
  onMoveSectionDown?: () => void
  onSetSectionColor?: (color: SectionColorKeyT | null) => void
  sectionColor?: SectionColorKeyT | null
  sectionName?: string
  sectionItemCount?: number
}

export function KosztorysRowActionsMenu({
  sortActive,
  removeBlockReason,
  removeNeedsConfirm,
  onInsertAbove,
  onInsertBelow,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRemoveSection,
  onInsertSectionAbove,
  onInsertSectionBelow,
  onMoveSectionUp,
  onMoveSectionDown,
  onSetSectionColor,
  sectionColor,
  sectionName,
  sectionItemCount,
}: PropsT) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sectionConfirmOpen, setSectionConfirmOpen] = useState(false)
  // Disabled items are pointer-events-none, so an order-dependent group is wrapped in a tooltip
  // trigger (which catches the hover the disabled items would otherwise pass through).
  const withSortHint = (items: ReactNode) =>
    sortActive ? (
      <SimpleTooltip content="Przyciski zablokowane — wyłącz sortowanie kolumn, aby odblokować">
        <div>{items}</div>
      </SimpleTooltip>
    ) : (
      items
    )

  const itemOrderItems = (
    <>
      <DropdownMenuItem disabled={sortActive} onSelect={onInsertAbove}>
        <ArrowUpToLine />
        Wstaw powyżej
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onInsertBelow}>
        <ArrowDownToLine />
        Wstaw poniżej
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onMoveUp}>
        <ArrowUp />
        Przesuń w górę
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onMoveDown}>
        <ArrowDown />
        Przesuń w dół
      </DropdownMenuItem>
    </>
  )

  const sectionOrderItems = (
    <>
      {onInsertSectionAbove && (
        <DropdownMenuItem disabled={sortActive} onSelect={onInsertSectionAbove}>
          <ArrowUpToLine />
          Wstaw powyżej
        </DropdownMenuItem>
      )}
      {onInsertSectionBelow && (
        <DropdownMenuItem disabled={sortActive} onSelect={onInsertSectionBelow}>
          <ArrowDownToLine />
          Wstaw poniżej
        </DropdownMenuItem>
      )}
      {onMoveSectionUp && (
        <DropdownMenuItem disabled={sortActive} onSelect={onMoveSectionUp}>
          <ArrowUp />
          Przesuń w górę
        </DropdownMenuItem>
      )}
      {onMoveSectionDown && (
        <DropdownMenuItem disabled={sortActive} onSelect={onMoveSectionDown}>
          <ArrowDown />
          Przesuń w dół
        </DropdownMenuItem>
      )}
    </>
  )

  const removeItem = (
    <DropdownMenuItem
      variant="destructive"
      disabled={removeBlockReason != null}
      onSelect={() => (removeNeedsConfirm ? setConfirmOpen(true) : onRemove())}
    >
      <Trash2 />
      Usuń pozycję
    </DropdownMenuItem>
  )

  const sectionGroupShown = Boolean(
    onRemoveSection ??
      onInsertSectionAbove ??
      onInsertSectionBelow ??
      onMoveSectionUp ??
      onMoveSectionDown ??
      onSetSectionColor,
  )

  return (
    <>
      <DropdownMenu>
        {/* size-full: whole cell is the click target, else dsg selects the dead space around the icon. */}
        <DropdownMenuTrigger
          title="Akcje wiersza"
          className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-full cursor-pointer items-center justify-center outline-none"
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuLabel>Prace</DropdownMenuLabel>
          {withSortHint(itemOrderItems)}
          {removeBlockReason == null ? (
            removeItem
          ) : (
            <SimpleTooltip content={removeBlockReason}>
              <div>{removeItem}</div>
            </SimpleTooltip>
          )}
          {sectionGroupShown && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sekcje</DropdownMenuLabel>
              {withSortHint(sectionOrderItems)}
              {onSetSectionColor && (
                <SectionColorPicker value={sectionColor ?? null} onChange={onSetSectionColor} />
              )}
              {onRemoveSection && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setSectionConfirmOpen(true)}
                >
                  <Trash2 />
                  Usuń sekcję
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        title="Usunąć pozycję?"
        description="Pozycja i wpisane w niej ilości etapów zostaną usunięte."
        confirmLabel="Usuń"
        onConfirm={() => {
          onRemove()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={sectionConfirmOpen}
        title={`Usunąć sekcję „${sectionName}"?`}
        description={`Usunie też ${sectionItemCount} pozycji wraz z wpisanymi w nich ilościami etapów. Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        onConfirm={() => {
          onRemoveSection?.()
          setSectionConfirmOpen(false)
        }}
        onCancel={() => setSectionConfirmOpen(false)}
      />
    </>
  )
}
