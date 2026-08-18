'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InspectionForm } from '@/components/forms/inspection-form/inspection-form'
import { createInspectionAction } from '@/lib/actions/fleet'
import type { InspectionFormValuesT } from '@/components/forms/inspection-form/inspection-schema'
import type { FleetRowT } from '@/types/fleet'

type AddInspectionDialogPropsT = {
  vehicles: Pick<FleetRowT, 'id' | 'registration' | 'make' | 'model'>[]
  /** Preselected vehicle — the vehicle page knows which car the user is looking at. */
  vehicleId?: number
}

export function AddInspectionDialog({ vehicles, vehicleId }: AddInspectionDialogPropsT) {
  const defaultValues: InspectionFormValuesT = {
    vehicle: vehicleId ? String(vehicleId) : '',
    type: 'TECHNICAL',
    performedAt: '',
    nextDueAt: '',
    odometer: '',
    nextDueOdometer: '',
    cost: '',
    note: '',
  }

  return (
    <FormDialog
      formId="add-inspection"
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          Przegląd
        </Button>
      }
      title="Nowy przegląd"
    >
      {(onSubmitSuccess, keepOpen) => (
        <InspectionForm
          formId="add-inspection"
          defaultValues={defaultValues}
          lockedVehicleId={vehicleId}
          action={createInspectionAction}
          successMessage="Przegląd zapisany"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          vehicles={vehicles}
        />
      )}
    </FormDialog>
  )
}
