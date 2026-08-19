import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment'
import { insertKosztorysTree, type InsertKosztorysTreeResultT } from './insert-kosztorys-tree'
import type { SnapshotPayloadT } from './snapshot-format'

// Atomically revert an investment's whole kosztorys to a serialized snapshot: wipe the live tree,
// re-insert from the payload (insertKosztorysTree remaps child FKs to freshly-minted parent ids),
// then rewrite the investment editor-settings. THE CALLER OWNS THE TRANSACTION — pass a `req` carrying
// a `transactionID` (and optional `context`, e.g. `skipRevalidation`); every op below threads it so a
// throw anywhere rolls the whole thing back and the live tree is never left half-wiped.
export async function restoreKosztorys(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  snapshot: SnapshotPayloadT,
  { clearGlobalDiscount = false }: { clearGlobalDiscount?: boolean } = {},
): Promise<InsertKosztorysTreeResultT> {
  const db = await getDb(payload, req) // transaction-scoped Drizzle handle (req carries transactionID)
  const where = { investment: { equals: investmentId } }

  // Also taken by `replaceTreeWithSnapshot` before its pre-wipe snapshot; re-taking is free, and
  // this is the entry point „Przywróć wersję" reaches without it.
  await lockInvestmentForReplace(db, investmentId)

  // Wipe. Deleting sections DB-cascades their items → stage_progress; deleting stages cascades any
  // remaining stage_progress. Order between the two is immaterial — cascades cover both directions.
  await payload.delete({ collection: 'kosztorys-sections', where, req })
  await payload.delete({ collection: 'kosztorys-stages', where, req })

  const inserted = await insertKosztorysTree(db, investmentId, snapshot)

  // Load-bearing beyond the three columns it writes: it bumps `investment.updatedAt`, which is the
  // `revision` token `useRestoreRemount` latches on to remount the grid. Writing the same values back
  // is therefore NOT a deletable no-op — drop this and the editor keeps rendering the wiped rows.
  await payload.update({
    collection: 'investments',
    id: investmentId,
    req,
    data: {
      wToolsCoeff: snapshot.settings.wToolsCoeff,
      ownToolsCoeff: snapshot.settings.ownToolsCoeff,
      vatRate: snapshot.settings.vatRate,
      // The global discount lives outside the snapshot payload, so restoring a version leaves the
      // live amount discount alone. Only a caller replacing the rozpiska wholesale with zeroed
      // przedmiar asks for it to be cleared.
      ...(clearGlobalDiscount ? { globalDiscountType: null, globalDiscountValue: 0 } : {}),
    },
  })

  return inserted
}
