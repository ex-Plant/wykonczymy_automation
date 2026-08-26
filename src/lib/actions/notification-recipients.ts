'use server'

import { z } from 'zod'
import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { revalidateNotificationRecipients } from '@/lib/cache/revalidate'
import { RECIPIENT_LISTS, type RecipientListT } from '@/lib/email/recipients'
import type { ActionResultT } from '@/types/action'

const FORBIDDEN = 'Tylko właściciel może zmieniać odbiorców powiadomień'

// Trim before validating, not after: a pasted address arrives with a trailing space often enough
// that rejecting it would read as a bug, and storing it would mail nobody.
const emailsSchema = z
  .array(z.string().trim().pipe(z.email('Nieprawidłowy adres e-mail')))
  .min(1, 'Lista musi mieć co najmniej jednego odbiorcę')

/**
 * Rewrites ONE list. Read-modify-write, because `updateGlobal` writes the whole document: saving the
 * fleet list with only its own field in `data` would leave the other two absent — and Payload treats
 * an absent array as an empty one, silently emptying two lists the owner was not even looking at.
 */
export async function saveRecipientListAction(
  list: RecipientListT,
  emails: string[],
): Promise<ActionResultT> {
  return ownerOnlyAction('saveRecipientListAction', FORBIDDEN, async ({ payload }) => {
    if (!RECIPIENT_LISTS.includes(list))
      return { success: false, error: 'Nieznana lista odbiorców' }

    const parsed = emailsSchema.safeParse(emails)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

    const current = await payload.findGlobal({ slug: 'notification-recipients', depth: 0 })

    await payload.updateGlobal({
      slug: 'notification-recipients',
      data: {
        ...Object.fromEntries(RECIPIENT_LISTS.map((name) => [name, current[name] ?? []])),
        [list]: parsed.data.map((email) => ({ email })),
      },
    })

    revalidateNotificationRecipients()
    return { success: true }
  })
}
