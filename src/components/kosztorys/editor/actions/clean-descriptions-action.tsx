'use client'

import { useState } from 'react'
import { SpellCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { cleanItemDescriptionsAction } from '@/lib/actions/kosztorys'
import { toastMessage } from '@/lib/utils/toast'

// The one action with no dialog, so its state stays inside the item instead of being lifted.
export function CleanDescriptionsMenuItem() {
  const { investmentId, onTreeReplaced } = useKosztorysEditorContext()
  const [cleaning, setCleaning] = useState(false)

  // Rewrites every opis in place, so the grid is reseeded off the investment's revision token — the
  // same signal the sheet compare uses after it writes.
  function handleCleanDescriptions() {
    setCleaning(true)
    void cleanItemDescriptionsAction(investmentId)
      .then((res) => {
        if (!res.success) return toastMessage(res.error, 'error')
        if (res.data === 0) return toastMessage('Nie znaleziono nic do poprawienia', 'info')
        toastMessage(`Poprawiono opisy: ${res.data}`, 'success')
        onTreeReplaced?.()
      })
      .catch(() => toastMessage('Nie udało się poprawić opisów', 'error'))
      .finally(() => setCleaning(false))
  }

  return (
    <DropdownMenuItem onSelect={handleCleanDescriptions} disabled={cleaning}>
      <SpellCheck />
      <MenuItemBody
        label="Popraw literówki w opisie prac"
        description="Poprawia literówki, zbędne spacje i wielkie litery w całej rozpisce."
      />
    </DropdownMenuItem>
  )
}
