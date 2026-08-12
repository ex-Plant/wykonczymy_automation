import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { insertSnapshot } from '@/lib/db/snapshots'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { restoreKosztorys } from './restore-kosztorys'
import { serializeKosztorys } from './serialize-kosztorys'
import type { InsertKosztorysTreeResultT } from './insert-kosztorys-tree'
import type { SnapshotPayloadT } from './snapshot-format'

type OptionsT = {
  investmentId: number
  // `manual`, not `auto`, is what makes a wholesale replacement genuinely undoable: an auto snapshot
  // is ambient history — indistinguishable from the periodic autosaves in „Wersje", capped at the
  // newest 50 and swept after 7 days. A labelled manual row is exempt from both and shows up as a
  // named targetable entry, so „przywróć stan sprzed" stays a click rather than a guess.
  label: string
  takenBy: number
  tree: SnapshotPayloadT
  // The reload path alone passes this: a preset's przedmiar is all zeroes, so a surviving amount
  // discount would price the fresh rozpiska below nothing (`globalDiscountAmount` is deliberately
  // unclamped — see calc.ts). Every other replacement keeps the live discount.
  clearGlobalDiscount?: boolean
}

// Swap an investment's whole rozpiska for `tree`, reversibly. In ONE transaction: a forced pre-wipe
// snapshot (captured on the transaction handle and BEFORE the wipe — outside it, a rollback would
// leave the snapshot behind; after the wipe it would snapshot nothing) and the replacement itself.
// Any throw rolls both back and the live kosztorys is untouched.
//
// The investment's own editor-settings (VAT, coefficients) are never taken from `tree`: they are
// per-job pricing config, so a preset or a sheet must not carry one job's config onto another.
export async function replaceTreeWithSnapshot(
  payload: Payload,
  { investmentId, label, takenBy, tree, clearGlobalDiscount }: OptionsT,
): Promise<InsertKosztorysTreeResultT> {
  return withPayloadTransaction(
    payload,
    async (req) => {
      const current = await serializeKosztorys(investmentId)
      await insertSnapshot(await getDb(payload, req), {
        investmentId,
        kind: 'manual',
        label,
        takenBy,
        payload: current,
      })
      return restoreKosztorys(
        payload,
        req,
        investmentId,
        { ...tree, settings: current.settings },
        { clearGlobalDiscount },
      )
    },
    { skipRevalidation: true },
  )
}
