import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchEquipmentOverview } from '@/lib/queries/equipment'
import { EquipmentDataTable } from '@/components/equipment/equipment-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { warsawToday } from '@/lib/fleet/days'
import { pluralize } from '@/lib/utils/polish-plural'

export default async function EquipmentPage() {
  // Per-page, because `src/proxy.ts` only checks that a cookie exists — nothing else would catch a
  // missing guard here.
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const { equipment } = await fetchEquipmentOverview()
  const inUse = equipment.filter((item) => isLiveStatus(item.status)).length

  return (
    <PageWrapper title="Sprzęt">
      <Description>
        {inUse} {pluralize(inUse, ['sztuka', 'sztuki', 'sztuk'])} w użyciu
      </Description>
      <EquipmentDataTable data={equipment} today={warsawToday()} />
    </PageWrapper>
  )
}
