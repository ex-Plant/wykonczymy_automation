'use client'

import { useState } from 'react'
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Trash2 } from 'lucide-react'

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
  // Insert + move have no meaning against a sorted view — array position no longer mirrors
  // display_order — so they go dead while any sort is on, whatever its scope.
  sortActive: boolean
  item: OrderActionsT & { onRemove: () => void }
  // Absent (read-only view) → the whole „Sekcja" group is hidden.
  section?: SectionActionsT
}

export function KosztorysRowActionsMenu({ sortActive, item, section }: PropsT) {
  const [pendingRemoval, setPendingRemoval] = useState<'item' | 'section' | null>(null)
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
          <DropdownMenuItem variant="destructive" onSelect={() => setPendingRemoval('item')}>
            <Trash2 />
            Usuń pozycję
          </DropdownMenuItem>
          {section && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sekcja</DropdownMenuLabel>
              {orderItems(section)}
              <SectionColorPicker value={section.color} onChange={section.onSetColor} />
              <DropdownMenuItem variant="destructive" onSelect={() => setPendingRemoval('section')}>
                <Trash2 />
                Usuń sekcję
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={pendingRemoval !== null}
        title={
          pendingRemoval === 'section'
            ? `Usunąć sekcję „${section?.name}" (${section?.itemCount} poz.)?`
            : 'Usunąć pozycję?'
        }
        description="Usunięte zostaną też wpisane ilości etapów. Cofnięcie w edytorze nie zadziała — przywrócisz je tylko z zapisanej wersji."
        confirmLabel="Usuń"
        onConfirm={() => {
          if (pendingRemoval === 'section') section?.onRemove()
          else item.onRemove()
          setPendingRemoval(null)
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </>
  )
}
