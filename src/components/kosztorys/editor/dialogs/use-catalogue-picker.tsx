'use client'

import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { AddItemsFromCatalogueDialog } from '@/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// Stable for the life of the host, so nothing under it re-renders when the picker opens.
type OpenCataloguePickerT = (sectionId?: number) => void

const CataloguePickerContext = createContext<OpenCataloguePickerT | null>(null)

// Two triggers, one dialog: „Dodaj → Praca z katalogu…" in the toolbar and „Praca z katalogu…" on a
// row's menu. Neither can render it — DropdownMenuContent unmounts its children on select — so the
// dialog lives here and the triggers only call the opener.
//
// `children` is a prop, not JSX built inside: opening the picker changes only this component's
// state, and React skips a subtree whose element identity is unchanged. That is what keeps the grid
// out of the re-render — the same value-identity discipline that made KosztorysActionsProvider a
// separate provider (EX-496).
export function CataloguePickerHost({ children }: { children: ReactNode }) {
  const { subtotals, handleAppendedCatalogueItems } = useKosztorysEditorContext()
  // `null` = closed; a member `sectionId` of `null` = open with no section chosen yet.
  const [target, setTarget] = useState<{ sectionId: number | null } | null>(null)
  const open = useCallback<OpenCataloguePickerT>(
    (sectionId) => setTarget({ sectionId: sectionId ?? null }),
    [],
  )

  return (
    <CataloguePickerContext value={open}>
      {children}
      {/* Mounted only while open, so every opening starts with an empty zaznaczenie and an empty
          szukajka without a reset path to maintain. */}
      {target && (
        <AddItemsFromCatalogueDialog
          sections={subtotals}
          initialSectionId={target.sectionId}
          open
          onOpenChange={() => setTarget(null)}
          onInserted={handleAppendedCatalogueItems}
        />
      )}
    </CataloguePickerContext>
  )
}

export function useCataloguePicker() {
  const open = use(CataloguePickerContext)
  if (!open) throw new Error('useCataloguePicker must be used within CataloguePickerHost')
  return open
}
