import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { NOTIFICATION_RECIPIENTS_TAG } from '@/lib/cache/tags'
import { readRecipientLists, type RecipientListsT } from '@/lib/email/recipients'

/**
 * The page-side read: cached and tag-invalidated, unlike the senders' own `readRecipientLists`.
 *
 * The two layers exist because the readers run in different worlds — a cron or a webhook is outside
 * any request cache, so a sender caching this would be reading a tag nothing in its process ever
 * invalidates.
 */
export const fetchRecipientLists = unstable_cache(
  async (): Promise<RecipientListsT> => readRecipientLists(await getPayload({ config })),
  ['notification-recipients'],
  { tags: [NOTIFICATION_RECIPIENTS_TAG] },
)
