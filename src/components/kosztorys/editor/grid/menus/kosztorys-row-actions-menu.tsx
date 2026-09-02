'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  BookmarkPlus,
  ListChecks,
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
import { SaveItemToCatalogueDialog } from '@/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog'
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
  // The POZYCJA's id, not a catalogue row's — an id rather than a callback because the dialog reads
  // every figure it shows from the server by it. Absent (read-only view) → no „Zapisz do katalogu…".
  // `onAddFromCatalogue` rides the SECTION's gate instead: the praca lands in this row's sekcja.
  item: OrderActionsT & {
    onRemove: () => void
    savableItemId?: number
    onAddFromCatalogue?: () => void
  }
  // Absent (read-only view) → the whole „Sekcja" group is hidden.
  section?: SectionActionsT
}

export function KosztorysRowActionsMenu({ sortActive, item, section }: PropsT) {
  const [pendingRemoval, setPendingRemoval] = useState<'item' | 'section' | null>(null)
  const [catalogueSaveOpen, setCatalogueSaveOpen] = useState(false)
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
        <CellMenuTrigger title="Akcje wiersza" />
        <DropdownMenuContent align="start" className="min-w-44">
          {/* Names the target: both groups carry the same four order commands, so the label is the
              only thing saying whether „Przesuń w górę" moves the row or the whole section. */}
          <DropdownMenuLabel>Praca</DropdownMenuLabel>
          {orderItems(item)}
          {item.savableItemId !== undefined && (
            <DropdownMenuItem onSelect={() => setCatalogueSaveOpen(true)}>
              <BookmarkPlus />
              Zapisz pozycję do katalogu prac
            </DropdownMenuItem>
          )}
          {/* Not disabled under a sort, unlike the four commands above it: the praca lands at the END
              of this row's section, so array position — the reason those go dead — is irrelevant. */}
          {item.onAddFromCatalogue && (
            <DropdownMenuItem onSelect={item.onAddFromCatalogue}>
              <ListChecks />
              Wybierz pozycję z katalogu prac
            </DropdownMenuItem>
          )}
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
      {/* Mounted only while open: the menu renders once per row, and the dialog fetches on mount. */}
      {catalogueSaveOpen && item.savableItemId !== undefined && (
        <SaveItemToCatalogueDialog
          itemId={item.savableItemId}
          open
          onOpenChange={setCatalogueSaveOpen}
        />
      )}
    </>
  )
}
