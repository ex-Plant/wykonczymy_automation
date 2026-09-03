import type { Payload } from 'payload'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import type { StampT } from '@/lib/equipment/digest'
import type { EquipmentWarrantyRowT } from '@/lib/equipment/types'

/**
 * One read: the register is a few hundred items at most, and the sweep judges every one of them.
 * Takes `payload` rather than importing `@payload-config` so the cron can share it.
 */
export async function loadWarrantyRows(payload: Payload): Promise<EquipmentWarrantyRowT[]> {
  const page = await payload.find({
    collection: 'equipment',
    sort: 'name',
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })

  return assertCompletePage(page, 'loadWarrantyRows').map((item) => ({
    id: item.id,
    name: item.name,
    make: item.make ?? '',
    model: item.model ?? '',
    serialNumber: item.serialNumber ?? '',
    status: item.status,
    warrantyUntil: item.warrantyUntil ?? null,
    warrantyNotifiedBucket: item.warrantyNotifiedBucket ?? null,
  }))
}

/**
 * Record what was announced — called only after a successful send. A stamp written ahead of the mail
 * would silence a warranty for good on a delivery that never happened, and unlike a fleet deadline
 * there is no weekly re-nag to recover it.
 *
 * Returns the ids that failed to stamp instead of throwing: the mail is already out, so a rejection
 * here would make the run report a total failure and earn a cron retry that re-sends the whole
 * digest. An unstamped row simply re-announces tomorrow, which is the harmless direction.
 *
 * One stamp at a time, never in parallel: the deployed database keeps one of a set of concurrent
 * Payload writes, drops the rest and reports success for all of them — so a parallel sweep would
 * report every row stamped while only one of them was. Copied from `lib/fleet/sweep-io.ts` for
 * exactly these reasons, not by habit.
 */
export async function stampNotified(
  payload: Payload,
  stamps: readonly StampT[],
  sentAt: Date = new Date(),
): Promise<number[]> {
  const at = sentAt.toISOString()
  const failed: number[] = []

  for (const stamp of stamps) {
    try {
      await payload.update({
        collection: 'equipment',
        id: stamp.equipmentId,
        overrideAccess: true,
        data: { warrantyNotifiedBucket: stamp.bucket, warrantyNotifiedAt: at },
      })
    } catch {
      failed.push(stamp.equipmentId)
    }
  }

  return failed
}
