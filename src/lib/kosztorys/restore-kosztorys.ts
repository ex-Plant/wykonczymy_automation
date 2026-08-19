import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
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
  // Also taken by `replaceTreeWithSnapshot` before its pre-wipe snapshot; re-taking is free, and
  // this is the entry point „Przywróć wersję" reaches without it.
  await lockInvestmentForReplace(db, investmentId)

  // Wipe. Deleting sections DB-cascades their items → stage_progress; deleting stages cascades any
  // remaining stage_progress. Order between the two is immaterial — cascades cover both directions.
  //
  // Raw SQL rather than `payload.delete({ where })`: the bulk delete loops document by document and
  // collects each failure into `result.errors` INSTEAD OF THROWING, so a row that refuses to go
  // leaves the wipe reporting success. The restore then inserts the fresh tree beside the survivor —
  // a duplicated section, and, when the survivor is an etap, an INSERT that meets
  // `kosztorys_stages_investment_ordinal_unique` and takes the whole restore down as a bogus
  // „concurrent write". One statement per table cannot half-succeed.
  await db.execute(sql`DELETE FROM kosztorys_sections WHERE investment_id = ${investmentId}`)
  await db.execute(sql`DELETE FROM kosztorys_stages WHERE investment_id = ${investmentId}`)

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
