import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, isAdminOrOwnerRole } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchFleetOverview } from '@/lib/queries/fleet'
import { fetchRecipientLists } from '@/lib/queries/notification-recipients'
import { FleetDataTable } from '@/components/fleet/fleet-data-table'
import { RecipientListCard } from '@/components/notification-recipients/recipient-list-card'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { parseDateRange } from '@/lib/utils/parse-date-range'
import { pluralize } from '@/lib/utils/polish-plural'
import type { PagePropsT } from '@/types/page'

export default async function FleetPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const payload = await getPayload({ config })
  const [, fleet, recipients] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.fleet),
    fetchFleetOverview(parseDateRange(await searchParams)),
    fetchRecipientLists(),
  ])
  // The window is a lens on money; the fleet is the same size whichever months you look at.
  const activeCount = fleet.filter((vehicle) => vehicle.status === 'ACTIVE').length

  return (
    <PageWrapper title="Flota">
      <Description>
        {activeCount} {pluralize(activeCount, ['pojazd', 'pojazdy', 'pojazdów'])} w użyciu
      </Description>
      <FleetDataTable data={fleet} />
      <RecipientListCard
        list="fleetDigest"
        title="Powiadomienia"
        description="E-mail wysyłany na podane adresy na 7 i 1 dzień przed datą przeglądu i co tydzień, dopóki nie zostanie odnowiony. Limit kilometrów wymiany oleju aktualizujemy przy każdej aktualizacji licznika."
        emails={recipients.fleetDigest}
        canEdit={isAdminOrOwnerRole(session.user.role)}
      />
    </PageWrapper>
  )
}
