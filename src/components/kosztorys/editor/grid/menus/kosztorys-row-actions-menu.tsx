'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  CheckCheck,
  Trash2,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { SortScopeT } from '@/lib/kosztorys/row-view'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'

type OrderActionsT = {
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

// One bundle rather than a callback per command: they all come from the same `editorOnly()` gate, so
// they are all-present or all-absent — as separate props the „Sekcja" group could half-appear.
type SectionActionsT = OrderActionsT & {
  color: SectionColorKeyT | null
  name?: string
  itemCount: number
  onSetColor: (color: SectionColorKeyT | null) => void
  onRemove: () => void
}

type PropsT = {
  // The active sort's scope, or null for no sort. Insert + move have no meaning against a
  // price-sorted view under either scope; the scope itself decides whether the order can be stored.
  sortScope: SortScopeT | null
  // Why delete is blocked (only the empty-sheet floor now), or undefined if removable. Present →
  // delete disabled with the reason in a tooltip (disabled items are pointer-events-none, so a
  // native title never fires).
  removeBlockReason?: string
  // Populated row: delete destroys recorded stage progress, so route through a confirm dialog first.
  removeNeedsConfirm?: boolean
  item: OrderActionsT & { onRemove: () => void }
  // „Etapy są prawdą" — absent unless this pozycja actually carries an imported pomiar, so a
  // kosztorys that never came from a sheet never shows the command.
  onClearSheetMeasuredQty?: () => void
  // Absent (read-only view) → the whole „Sekcja" group is hidden.
  section?: SectionActionsT
}

export function KosztorysRowActionsMenu({
  sortScope,
  removeBlockReason,
  removeNeedsConfirm,
  item,
  onClearSheetMeasuredQty,
  section,
}: PropsT) {
  const sortActive = sortScope != null
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sectionConfirmOpen, setSectionConfirmOpen] = useState(false)
  // The wrapper div is not decoration: a disabled item is pointer-events-none and would swallow the
  // hover, and a menu item makes a poor tooltip trigger anyway — both are Radix primitives fighting
  // over the same ref and props. The div catches the hover for either case.
  const withHint = (items: ReactNode, reason?: string) =>
    reason == null ? (
      items
    ) : (
      <SimpleTooltip content={reason}>
        <div>{items}</div>
      </SimpleTooltip>
    )

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
          {/* Names the target: both groups carry the same four order commands, so the label is the
              only thing saying whether „Przesuń w górę" moves the row or the whole section. */}
          <DropdownMenuLabel>Praca</DropdownMenuLabel>
          {orderItems(item)}
          {onClearSheetMeasuredQty &&
            withHint(
              <DropdownMenuItem onSelect={onClearSheetMeasuredQty}>
                <CheckCheck />
                Etapy są prawdą
              </DropdownMenuItem>,
              'Usuwa pomiar wpisany w arkuszu — od tej pory prawdą dla tej pozycji są wyłącznie etapy',
            )}
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
          {section && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sekcja</DropdownMenuLabel>
              {orderItems(section)}
              <SectionColorPicker value={section.color} onChange={section.onSetColor} />
              <DropdownMenuItem variant="destructive" onSelect={() => setSectionConfirmOpen(true)}>
                <Trash2 />
                Usuń sekcję
              </DropdownMenuItem>
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
          item.onRemove()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={sectionConfirmOpen}
        title={`Usunąć sekcję „${section?.name}"?`}
        description={`Usunie też ${section?.itemCount} pozycji wraz z wpisanymi w nich ilościami etapów. Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        onConfirm={() => {
          section?.onRemove()
          setSectionConfirmOpen(false)
        }}
        onCancel={() => setSectionConfirmOpen(false)}
      />
    </>
  )
}
