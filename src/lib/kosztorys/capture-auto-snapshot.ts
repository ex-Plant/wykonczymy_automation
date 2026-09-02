import type { DbExecutorT } from '@/lib/db/get-db'
import { insertSnapshot } from '@/lib/db/snapshots'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'

// Take an unconditional auto snapshot of the investment's current tree + settings. Used by the
// periodic client interval AND (forced) right before a cascade delete, so a delete noticed a day
// later is recoverable. No throttle, no dedupe, no inline prune — the daily GC thins the table on
// its own (owner: keep it dead-simple now; the idle-suppression check lands with S-07).
export async function captureAutoSnapshot(
  db: DbExecutorT,
  investmentId: number,
  takenBy: number | null,
): Promise<void> {
  const snapshot = await serializeKosztorys(investmentId)
  await insertSnapshot(db, { investmentId, kind: 'auto', label: null, takenBy, payload: snapshot })
}
