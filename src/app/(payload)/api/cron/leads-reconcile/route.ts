import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { serverEnv } from '@/lib/env/server'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'
import { notifyReconcileRecovery } from '@/lib/leads/notify'

// Daily backstop for the Meta lead webhook, whose failure mode is silent (lessons.md).
// Vercel Cron invokes it as a GET carrying `Authorization: Bearer $CRON_SECRET`.
// Recovering anything means the webhook isn't delivering, so a non-zero run alerts.
export async function GET(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET
  // Fail closed: an unset secret can't be authenticated against, so reject everything.
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  try {
    const { added, scanned } = await runLeadReconcileSweep(payload)

    if (added > 0) {
      // Route Handler context — `updateTag` throws here, unlike in the server action.
      revalidateTag(CACHE_TAGS.leads, 'default')
      await notifyReconcileRecovery(payload, { added, scanned }).catch((err) =>
        console.error('[cron/leads-reconcile] Recovery alert failed', err),
      )
    }

    return NextResponse.json({ ok: true, added, scanned }, { status: 200 })
  } catch (err) {
    // Surface a Graph outage as a failed run — a silent `ok: true` would make the
    // backstop look healthy while it recovers nothing.
    console.error('[cron/leads-reconcile] Sweep failed', err)
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 })
  }
}
