'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { updateCatalogueItemAction } from '@/lib/actions/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type EditCatalogueItemDialogPropsT = {
  item: WorkCatalogueItemT
  categorySuggestions: readonly string[]
}

export function EditCatalogueItemDialog({
  item,
  categorySuggestions,
}: EditCatalogueItemDialogPropsT) {
  const formId = `edit-catalogue-item-${item.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={
        <Button size="xs" variant="outline" aria-label="Edytuj pozycję katalogu">
          <Pencil />
          <span>Edytuj</span>
        </Button>
      }
      title="Edytuj pozycję katalogu"
      description={item.description}
    >
      {(onSubmitSuccess, keepOpen) => (
        <WorkCatalogueItemForm
          formId={formId}
          defaultValues={{
            description: item.description,
            category: item.category ?? '',
            unit: item.unit,
            clientPrice: String(item.clientPrice),
            wToolsRate: String(item.wToolsRate),
            ownToolsRate: String(item.ownToolsRate),
          }}
          categorySuggestions={categorySuggestions}
          action={(data) => updateCatalogueItemAction(item.id, data)}
          successMessage="Pozycja zaktualizowana"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
        />
      )}
    </FormDialog>
  )
}
