import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment'
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
  // The sheet import alone passes this — see the note below on why every other caller must not.
  takeSettingsFromTree?: boolean
}

// A duplicate key here is never a data problem the owner can act on — it means someone else wrote
// this kosztorys mid-replacement (an etap added from another tab, say — the lock below covers the
// wholesale replacements, not every writer). Postgres's own text is an English dump of the failed
// INSERT and its fifty bind params, and `protectedAction` puts whatever it catches straight into the toast.
const CONCURRENT_WRITE =
  'Ktoś zmieniał ten kosztorys w tym samym czasie — nic nie zostało zapisane. Spróbuj ponownie.'

function isUniqueViolation(error: unknown): boolean {
  // Drizzle wraps the driver error, so the pg code sits somewhere down the `cause` chain.
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if ((current as { code?: unknown }).code === '23505') return true
  }
  return false
}

// Swap an investment's whole rozpiska for `tree`, reversibly. In ONE transaction: a forced pre-wipe
// snapshot (captured on the transaction handle and BEFORE the wipe — outside it, a rollback would
// leave the snapshot behind; after the wipe it would snapshot nothing) and the replacement itself.
// Any throw rolls both back and the live kosztorys is untouched.
//
// The investment's own editor-settings (VAT, coefficients) are not taken from `tree` by default:
// they are per-job pricing config, and a preset built for one job must not carry its config onto
// another.
//
// `takeSettingsFromTree` is the sheet import's exception, and it is load-bearing rather than a
// convenience: the import reads the markup out of the cennik's own formulas and, on the strength of
// that, hands every praca running at exactly that markup to the global coefficient („auto") instead
// of stamping it with a per-row multiplier. Drop the settings and those prace silently reprice at
// whatever the investment happened to hold — 0,55 against the sheet's 0,5525 is 151 stawki wrong by
// half a percent, each of them looking perfectly deliberate. `buildImportPlan` already merges VAT
// and any coefficient the sheet had no opinion about from the live investment, so what arrives here
// is the sheet's answer where it has one and the job's own everywhere else.
export async function replaceTreeWithSnapshot(
  payload: Payload,
  { investmentId, label, takenBy, tree, clearGlobalDiscount, takeSettingsFromTree }: OptionsT,
): Promise<InsertKosztorysTreeResultT> {
  try {
    return await withPayloadTransaction(
      payload,
      async (req) => {
        const db = await getDb(payload, req)
        // Before the read, not just before the wipe: the snapshot is „the state you can go back to",
        // and taken outside the lock it would describe a tree another replacement has already
        // superseded — and `current.settings` below would then write that stale config back.
        await lockInvestmentForReplace(db, investmentId)

        const current = await serializeKosztorys(investmentId)
        await insertSnapshot(db, {
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
          { ...tree, settings: takeSettingsFromTree ? tree.settings : current.settings },
          { clearGlobalDiscount },
        )
      },
      { skipRevalidation: true },
    )
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error(CONCURRENT_WRITE)
    throw error
  }
}
