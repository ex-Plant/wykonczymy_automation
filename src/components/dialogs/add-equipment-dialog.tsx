'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { AddEquipmentForm } from '@/components/forms/equipment-form/add-equipment-form'
import { createEquipmentAction } from '@/lib/actions/equipment'
import { warsawToday } from '@/lib/fleet/days'
import type { AddEquipmentFormValuesT } from '@/components/forms/equipment-form/equipment-schema'
import type { WarehouseOptionT } from '@/lib/queries/equipment'
import type { WorkerRefT } from '@/types/reference-data'

type AddEquipmentDialogPropsT = {
  workers: WorkerRefT[]
  warehouses: WarehouseOptionT[]
}

export function AddEquipmentDialog({ workers, warehouses }: AddEquipmentDialogPropsT) {
  const defaultValues: AddEquipmentFormValuesT = {
    name: '',
    serialNumber: '',
    make: '',
    model: '',
    purchaseDate: '',
    warrantyUntil: '',
    purchasePrice: '',
    note: '',
    status: 'IN_USE',
    occurredAt: warsawToday(),
    targetKind: 'warehouse',
    holder: '',
    warehouse: '',
    serviceProvider: '',
  }

  return (
    <FormDialog
      formId="add-equipment"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Sprzęt
        </Button>
      }
      title="Nowy sprzęt"
    >
      {(onSubmitSuccess, keepOpen) => (
        <AddEquipmentForm
          formId="add-equipment"
          defaultValues={defaultValues}
          action={createEquipmentAction}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          workers={workers}
          warehouses={warehouses}
        />
      )}
    </FormDialog>
  )
}
