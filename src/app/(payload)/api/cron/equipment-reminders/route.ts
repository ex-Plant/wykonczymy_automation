import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { warsawToday } from '@/lib/dates/days'
import { buildEquipmentDigest, isEmptyDigest } from '@/lib/equipment/digest'
import { notifyEquipmentDigest } from '@/lib/equipment/notify'
import { loadWarrantyRows, stampNotified } from '@/lib/equipment/sweep-io'

// Scheduled from vercel.json. Its own handler rather than a second stream inside the fleet's, so a
// failure on one side cannot swallow the other side's mail.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const digest = buildEquipmentDigest(await loadWarrantyRows(payload), warsawToday())

    const sections = { within7: digest.within7.length, within30: digest.within30.length }

    if (isEmptyDigest(digest)) {
      return NextResponse.json({ ok: true, sent: false, sections }, { status: 200 })
    }

    await notifyEquipmentDigest(payload, digest)
    // Only after the send: see stampNotified.
    const stampFailures = await stampNotified(payload, digest.stamps)

    if (stampFailures.length > 0) {
      // TODO(EX-449) SENTRY-REQUIRED: these rows will re-announce tomorrow.
      console.error('[cron/equipment-reminders] Stamp failed for equipment', stampFailures)
    }

    return NextResponse.json(
      { ok: true, sent: true, sections, stampFailures: stampFailures.length },
      { status: 200 },
    )
  } catch (err) {
    // A module whose whole value is a mail that arrives must read as a failed run when it doesn't.
    // TODO(EX-449) SENTRY-REQUIRED: this is the only record that the reminders stopped.
    console.error('[cron/equipment-reminders] Sweep failed', err)

    return NextResponse.json({ error: 'Equipment reminder sweep failed' }, { status: 500 })
  }
}
