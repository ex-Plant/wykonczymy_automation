'use client'

import { useState } from 'react'
import { FolderPlus, Hammer, LibraryBig, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddSectionsFromPresetDialog } from '@/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PLANE_LABELS, TOOL_PLANES } from '@/lib/kosztorys/constants'

export function KosztorysAddMenu() {
  const {
    investmentId,
    subtotals,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
  } = useKosztorysEditorContext()
  // Owned here, OUTSIDE the dropdown content: the menu unmounts on close, so a dialog rendered inside
  // it would unmount before it could open. The item only flips this flag.
  const [pickerOpen, setPickerOpen] = useState(false)

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
          {/* No section is preselected — any default lands the praca where the user isn't looking,
              which is the whole reason this is a picker. Names are not unique, so the pozycja count
              (as on the section band) is what tells two „Łazienka" apart. With nothing to pick from
              the submenu is dropped rather than offered empty; „Praca" then goes through
              handleAddSection, which mints a section WITH its first pozycja inside. */}
          {subtotals.length === 0 ? (
            <DropdownMenuItem onSelect={handleAddSection}>
              <Hammer />
              Praca
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Hammer />
                Praca
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {subtotals.map((section) => (
                  <DropdownMenuItem
                    key={section.sectionId}
                    onSelect={() => handleAddItem(section.sectionId)}
                  >
                    {section.sectionName} ({section.itemCount} poz.)
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
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
