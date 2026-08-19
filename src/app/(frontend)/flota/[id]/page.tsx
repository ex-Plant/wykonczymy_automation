import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchVehicleDetail } from '@/lib/queries/fleet'
import { AddInspectionDialog } from '@/components/dialogs/add-inspection-dialog'
import { OilIntervalBadge } from '@/components/fleet/oil-interval-badge'
import { VehicleFlags } from '@/components/fleet/vehicle-flags'
import { VehicleStatusBadge } from '@/components/fleet/vehicle-status-badge'
import { VehicleDetailTabs } from '@/components/fleet/vehicle-detail-tabs'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { formatKm } from '@/lib/utils/format-distance'
import type { DynamicPagePropsT } from '@/types/page'

export default async function VehicleDetailPage({ params }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const { id } = await params
  // Arriving straight from the digest mail also counts as looking at the fleet.
  const payload = await getPayload({ config })
  const [, detail] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.fleet),
    fetchVehicleDetail(Number(id)),
  ])
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
            { label: 'Status', value: <VehicleStatusBadge status={vehicle.status} /> },
            { label: 'VIN', value: vehicle.vin || '—' },
            {
              label: 'Do wymiany',
              value: <VehicleFlags vehicleId={vehicle.id} active={vehicle.activeFlags} />,
            },
            {
              label: 'Od wymiany oleju',
              value: (
                <span className="flex items-center gap-2">
                  {vehicle.kmSinceOilChange === null ? '—' : formatKm(vehicle.kmSinceOilChange)}
                  <OilIntervalBadge kmSinceOilChange={vehicle.kmSinceOilChange} />
                </span>
              ),
            },
          ]}
        />
        <AddInspectionDialog vehicles={[vehicle]} vehicleId={vehicle.id} />
      </div>

      <VehicleDetailTabs historyByType={historyByType} />
    </PageWrapper>
  )
}
