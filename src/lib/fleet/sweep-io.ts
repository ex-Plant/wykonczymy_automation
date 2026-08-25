import type { Payload } from 'payload'
import { groupByVehicle, loadFleetDataset } from '@/lib/fleet/dataset'
import type { VehicleHistoryT } from '@/lib/fleet/types'
import type { StampT } from '@/lib/fleet/reminder-sweep'

export const loadFleetHistories = async (payload: Payload): Promise<VehicleHistoryT[]> =>
  groupByVehicle(await loadFleetDataset(payload))

/**
 * Record what was announced — called only after a successful send. A stamp written ahead of the mail
 * would silence the deadline for a week on a delivery that never happened.
 *
 * Returns the ids that failed to stamp instead of throwing: the mail is already out, so a rejection
 * here would make the run report a total failure and earn a cron retry that re-sends the whole
 * digest. An unstamped row simply re-announces tomorrow, which is the harmless direction.
 *
 * One stamp at a time, never in parallel: the deployed database keeps one of a set of concurrent
 * Payload writes, drops the rest and reports success for all of them — so a parallel sweep would
 * report every row stamped while only one of them was, and re-announce the others daily until
 * someone noticed. Same failure that lost the pages of a deleted multi-page invoice; see
 * `lib/invoices/delete-unreferenced-media.ts`.
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
        collection: 'vehicle-inspections',
        id: stamp.inspectionId,
        overrideAccess: true,
        data: {
          ...(stamp.threshold !== null && { notifiedThreshold: stamp.threshold, notifiedAt: at }),
          ...(stamp.odometer && { odometerNotifiedAt: at }),
        },
      })
    } catch {
      failed.push(stamp.inspectionId)
    }
  }

  return failed
}
