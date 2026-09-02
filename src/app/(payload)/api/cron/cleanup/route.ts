import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots } from '@/lib/db/snapshots'

// Daily cleanup cron, scheduled from vercel.json. Today it only thins kosztorys snapshots; the
// handler is shaped so further stale-data sweeps append as more steps. gcSnapshots' per-band
// breakdown is forwarded verbatim because the function log is where a retention change is read back.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const db = await getDb(payload)

  const snapshots = await gcSnapshots(db)

  return NextResponse.json({ ok: true, snapshots }, { status: 200 })
}
