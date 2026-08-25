import 'server-only'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { getPreset } from '@/lib/db/presets'
import { applyPreset } from './apply-preset'

export type SeedResultT = 'ok' | 'not-found' | 'not-empty'

// Seed orchestration behind the investment-create flow. Resolves the preset payload from its row
// (never a client value), then in ONE transaction re-checks the target tree is empty and applies it —
// a throw rolls back and the tree is untouched. The empty-guard is a cheap invariant, not a lock: it
// does NOT serialize two simultaneous seeds, since under READ COMMITTED a zero-row SELECT takes no
// lock and there's no UNIQUE(investment_id). Returns a discriminant; the CALLING ACTION owns auth +
// revalidation.
export async function seedInvestmentFromPreset(
  payload: Payload,
  investmentId: number,
  presetId: number,
): Promise<SeedResultT> {
  const preset = await getPreset(await getDb(payload), presetId)
  if (!preset) return 'not-found'

  return withPayloadTransaction(
    payload,
    async (req): Promise<SeedResultT> => {
      const txDb = await getDb(payload, req)
      const existing = await txDb.execute(
        sql`SELECT 1 FROM kosztorys_sections WHERE investment_id = ${investmentId} LIMIT 1`,
      )
      // Read-only bail: no writes happened, so committing this empty tree-check is equivalent to a rollback.
      if (existing.rows.length > 0) return 'not-empty'
      await applyPreset(payload, req, investmentId, preset.payload)
      // A preset carries no etapy and the seed installs none: an etap's plane is forced at creation
      // (addStageAction), and a seeded etap could only guess one. A guessed plane reads as confirmed
      // while nobody chose it, and an unconfirmed (null) one drops out of both subcontractor views —
      // so the first etap is the user's explicit call, through the picker.
      return 'ok'
    },
    { skipRevalidation: true },
  )
}
