import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchFleetOverview } from '@/lib/queries/fleet'
import { FleetDataTable } from '@/components/fleet/fleet-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { pluralize } from '@/lib/utils/polish-plural'

export default async function FleetPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  // Viewing the list clears this user's unread badge.
  const payload = await getPayload({ config })
  const [, fleet] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.fleet),
    fetchFleetOverview(),
  ])
  const activeCount = fleet.filter((vehicle) => vehicle.status === 'ACTIVE').length

  return (
    <PageWrapper title="Flota">
      <Description>
        {activeCount} {pluralize(activeCount, ['pojazd', 'pojazdy', 'pojazdów'])} w użyciu
      </Description>
      <FleetDataTable data={fleet} />
    </PageWrapper>
  )
}
