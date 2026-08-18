import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchFleetOverview } from '@/lib/queries/fleet'
import { FleetDataTable } from '@/components/fleet/fleet-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function FleetPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const fleet = await fetchFleetOverview()
  const activeCount = fleet.filter((vehicle) => vehicle.status === 'ACTIVE').length

  return (
    <PageWrapper title="Flota">
      <Description>{activeCount} pojazdów w użyciu</Description>
      <FleetDataTable data={fleet} />
    </PageWrapper>
  )
}
