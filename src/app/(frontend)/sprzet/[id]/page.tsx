import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchEquipmentDetail } from '@/lib/queries/equipment'
import { EquipmentHistory } from '@/components/equipment/equipment-history'
import { EquipmentStatusBadge } from '@/components/equipment/equipment-status-badge'
import { LocationCell } from '@/components/equipment/location-cell'
import { WarrantyCell } from '@/components/equipment/warranty-cell'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { classifyWarranty, warrantyDaysLeft } from '@/lib/equipment/warranty-thresholds'
import { warsawToday } from '@/lib/fleet/days'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import type { DynamicPagePropsT } from '@/types/page'

export default async function EquipmentDetailPage({ params }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const { id } = await params
  const detail = await fetchEquipmentDetail(Number(id))
  if (!detail) notFound()

  const { equipment, history } = detail
  const today = warsawToday()
  const live = isLiveStatus(equipment.status)

  return (
    <PageWrapper
      title={equipment.name}
      description={[equipment.make, equipment.model].filter(Boolean).join(' ')}
    >
      <InfoList
        items={[
          { label: 'Status', value: <EquipmentStatusBadge status={equipment.status} /> },
          {
            label: 'Gdzie jest',
            value: (
              <LocationCell
                location={equipment.location}
                locatedAt={equipment.locatedAt}
                live={live}
              />
            ),
          },
          { label: 'Nr seryjny', value: equipment.serialNumber },
          {
            label: 'Gwarancja',
            value: (
              <WarrantyCell
                warrantyUntil={equipment.warrantyUntil}
                daysLeft={warrantyDaysLeft(equipment.warrantyUntil, today)}
                bucket={classifyWarranty(equipment.warrantyUntil, today)}
                muted={!live}
              />
            ),
          },
          {
            label: 'Zakup',
            value: equipment.purchaseDate ? formatPLDate(equipment.purchaseDate) : '',
          },
          { label: 'Cena zakupu', value: formatPLNOrDash(equipment.purchasePrice) },
          { label: 'Uwagi', value: equipment.note },
        ]}
      />

      <EquipmentHistory history={history} />
    </PageWrapper>
  )
}
