'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EditCatalogueItemDialog } from '@/components/dialogs/edit-catalogue-item-dialog'
import { deleteCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type PropsT = {
  item: WorkCatalogueItemT
  categorySuggestions: readonly string[]
}

export function CatalogueRowActions({ item, categorySuggestions }: PropsT) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteCatalogueItemAction(item.id)
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage('Usunięto pozycję z katalogu.', 'success')
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <EditCatalogueItemDialog item={item} categorySuggestions={categorySuggestions} />

      <Button size="xs" variant="destructive" onClick={() => setConfirming(true)}>
        <Trash2 />
        Usuń
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Usunąć pozycję z katalogu?"
        description="Kosztorysy, do których tę pracę już wstawiono, zostają bez zmian — mają własną kopię ceny i stawek."
        confirmLabel="Usuń"
        pending={pending}
        pendingLabel="Usuwam…"
        onConfirm={onDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
