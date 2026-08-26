import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, isAdminOrOwnerRole } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchAllLeads } from '@/lib/queries/leads'
import { fetchRecipientLists } from '@/lib/queries/notification-recipients'
import { LeadsDataTable } from '@/components/leads/leads-data-table'
import { RecipientListCard } from '@/components/notifications/recipient-list-card'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function LeadsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  // Viewing the list clears this user's unread badge — advance their read cursor.
  // Independent of the leads fetch, so overlap them rather than paying the write
  // round-trip before the (cached) read.
  const payload = await getPayload({ config })
  const [, leads, recipients] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.leads),
    fetchAllLeads(),
    fetchRecipientLists(),
  ])
  const newCount = leads.filter((lead) => lead.contactStatus === 'new').length
  const canEditRecipients = isAdminOrOwnerRole(session.user.role)

  return (
    <PageWrapper title="Zgłoszenia">
      <Description>{newCount} nowych</Description>
      <LeadsDataTable data={leads} />
      <div className="grid gap-4 sm:grid-cols-2">
        <RecipientListCard
          list="newLead"
          title="Powiadomienia o nowych zgłoszeniach"
          emails={recipients.newLead}
          canEdit={canEditRecipients}
        />
        <RecipientListCard
          list="opsAlerts"
          title="Alerty techniczne"
          emails={recipients.opsAlerts}
          canEdit={canEditRecipients}
        />
      </div>
    </PageWrapper>
  )
}
