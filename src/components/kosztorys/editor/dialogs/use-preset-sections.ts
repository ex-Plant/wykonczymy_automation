'use client'

import { listPresetSectionsAction } from '@/lib/actions/kosztorys-presets'
import { useListOnOpen } from '@/components/kosztorys/editor/dialogs/use-list-on-open'
import type { PresetSectionMetaT } from '@/lib/db/presets'

export function usePresetSections(open: boolean) {
  const { items, reset } = useListOnOpen<PresetSectionMetaT>(
    open,
    listPresetSectionsAction,
    'Nie udało się wczytać szablonów',
  )
  return { sections: items, resetSections: reset }
}
