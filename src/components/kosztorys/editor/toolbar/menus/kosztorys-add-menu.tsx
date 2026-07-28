'use client'

import { useState } from 'react'
import { FolderPlus, Hammer, LibraryBig, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddSectionsFromPresetDialog } from '@/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PLANE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'

export function KosztorysAddMenu() {
  const {
    investmentId,
    collapsedSectionIds,
    subtotals,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
  } = useKosztorysEditorContext()
  // Owned here, OUTSIDE the dropdown content: the menu unmounts on close, so a dialog rendered inside
  // it would unmount before it could open. The item only flips this flag.
  const [pickerOpen, setPickerOpen] = useState(false)

  // The new praca lands in the single expanded section when the fold isolates one, else the last.
  const expanded = subtotals.filter((s) => !collapsedSectionIds.has(s.sectionId))
  const onlyExpanded = expanded.length === 1 ? expanded[0].sectionId : undefined
  const addItemSectionId = onlyExpanded ?? subtotals.at(-1)?.sectionId ?? null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Dodaj
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            disabled={addItemSectionId == null}
            onSelect={() => addItemSectionId != null && handleAddItem(addItemSectionId)}
          >
            <Hammer />
            Praca
          </DropdownMenuItem>
          {/* Plane is forced at creation — each etap plane is its own top-level item, so there is no
              plane-less „Etap" and no new stage is ever unconfirmed. The worker is deliberately NOT
              forced the same way: an unassigned etap is a legitimate resting state (it earns its own
              residual row), so it is picked later from the etap header, not here. */}
          {TOOL_PLANES.map((plane) => (
            <DropdownMenuItem key={plane} onSelect={() => handleAddStage(plane)}>
              {planeIcon(plane)}
              Etap — {PLANE_LABELS[plane].toLowerCase()}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={handleAddSection}>
            <FolderPlus />
            Sekcja
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            <LibraryBig />
            Sekcja z szablonu…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddSectionsFromPresetDialog
        investmentId={investmentId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAppended={handleAppendedSections}
      />
    </>
  )
}
