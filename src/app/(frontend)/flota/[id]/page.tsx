import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchVehicleDetail } from '@/lib/queries/fleet'
import { AddInspectionDialog } from '@/components/dialogs/add-inspection-dialog'
import { InspectionHistory } from '@/components/fleet/inspection-history'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { VEHICLE_STATUS_LABELS } from '@/lib/fleet/inspection-types'
import type { DynamicPagePropsT } from '@/types/page'

export default async function VehicleDetailPage({ params }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const { id } = await params
  const detail = await fetchVehicleDetail(Number(id))
  if (!detail) notFound()

  const { vehicle, historyByType } = detail

  return (
    <PageWrapper
      title={vehicle.registration}
      description={`${vehicle.make} ${vehicle.model}${vehicle.year ? ` · ${vehicle.year}` : ''}`}
      backHref="/flota"
      backLabel="Flota"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <InfoList
          items={[
            { label: 'Status', value: VEHICLE_STATUS_LABELS[vehicle.status].pl },
            { label: 'VIN', value: vehicle.vin || '—' },
          ]}
        />
        <AddInspectionDialog vehicles={[vehicle]} vehicleId={vehicle.id} />
      </div>

      <InspectionHistory historyByType={historyByType} />
    </PageWrapper>
  )
}
