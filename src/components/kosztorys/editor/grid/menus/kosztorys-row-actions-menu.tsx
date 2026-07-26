'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { SimpleTooltip } from '@/components/ui/tooltip'

type OrderActionsT = {
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

type PropsT = {
  // Insert + move have no meaning against a price-sorted view — disabled with a hint.
  sortActive: boolean
  // Why delete is blocked (only the empty-sheet floor now), or undefined if removable. Present →
  // delete disabled with the reason in a tooltip (disabled items are pointer-events-none, so a
  // native title never fires).
  removeBlockReason?: string
  // Populated row: delete destroys recorded stage progress, so route through a confirm dialog first.
  removeNeedsConfirm?: boolean
  item: OrderActionsT & { onRemove: () => void }
}

export function KosztorysRowActionsMenu({
  sortActive,
  removeBlockReason,
  removeNeedsConfirm,
  item,
}: PropsT) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Disabled items are pointer-events-none, so anything disabled is wrapped in a tooltip trigger,
  // which catches the hover the disabled item would otherwise pass through.
  const withHint = (items: ReactNode, reason?: string) =>
    reason == null ? (
      items
    ) : (
      <SimpleTooltip content={reason}>
        <div>{items}</div>
      </SimpleTooltip>
    )

  const sortHint = sortActive
    ? 'Przyciski zablokowane — wyłącz sortowanie kolumn, aby odblokować'
    : undefined

  const orderItems = ({ onInsertAbove, onInsertBelow, onMoveUp, onMoveDown }: OrderActionsT) => (
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

  return (
    <>
      <DropdownMenu>
        {/* size-full: whole cell is the click target, else dsg selects the dead space around the icon.
            The button chrome therefore sits on an inner span — the trigger itself has to stay
            cell-sized and unstyled. */}
        <CellMenuTrigger title="Akcje wiersza" />
        <DropdownMenuContent align="start" className="min-w-44">
          {/* Names the target: this menu and the band's carry the same four order commands, so
              without it the only cue is which row you happened to click. */}
          <DropdownMenuLabel>Praca</DropdownMenuLabel>
          {withHint(orderItems(item), sortHint)}
          {withHint(
            <DropdownMenuItem
              variant="destructive"
              disabled={removeBlockReason != null}
              onSelect={() => (removeNeedsConfirm ? setConfirmOpen(true) : item.onRemove())}
            >
              <Trash2 />
              Usuń pozycję
            </DropdownMenuItem>,
            removeBlockReason,
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        title="Usunąć pozycję?"
        description="Pozycja i wpisane w niej ilości etapów zostaną usunięte."
        confirmLabel="Usuń"
        onConfirm={() => {
          item.onRemove()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
