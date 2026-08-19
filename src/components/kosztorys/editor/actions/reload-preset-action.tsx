'use client'

import { FileDown } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function ReloadPresetMenuItem() {
  const { reloadPreset } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={() => reloadPreset.setOpen(true)}>
      <FileDown />
      <MenuItemBody
        label="Wczytaj szablon…"
        description="Zastąp całą rozpiskę zapisanym szablonem."
      />
    </DropdownMenuItem>
  )
}
