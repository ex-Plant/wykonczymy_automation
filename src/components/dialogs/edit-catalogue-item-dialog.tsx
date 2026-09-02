'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
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
        <SimpleTooltip content="Edytuj pozycję">
          <Button size="xs" variant="ghost" className="px-1.5" aria-label="Edytuj pozycję katalogu">
            <Pencil />
          </Button>
        </SimpleTooltip>
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
            wToolsAuto: item.wToolsRate === null,
            wToolsRate: item.wToolsRate?.toString() ?? '',
            ownToolsAuto: item.ownToolsRate === null,
            ownToolsRate: item.ownToolsRate?.toString() ?? '',
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
