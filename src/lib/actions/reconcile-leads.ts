'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollection } from '@/lib/cache/revalidate'
import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'
import type { ActionResultT } from '@/types/action'
import { getErrorMessage } from './run-action'

export type ReconcileLeadsResultT = ActionResultT<{ added: number; scanned: number }>

/**
 * Manual backstop for the webhook, behind the „Pobierz zgłoszenia" button. The
 * sweep itself lives in `reconcile-sweep.ts` and is shared with the daily cron;
 * this wrapper owns only what an action context adds — auth and `updateTag`-based
 * revalidation, which a Route Handler cannot use.
 */
export async function reconcileLeads(): Promise<ReconcileLeadsResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    const { added, scanned } = await runLeadReconcileSweep(payload)

    if (added > 0) revalidateCollection('leads')
    return { success: true, data: { added, scanned } }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
