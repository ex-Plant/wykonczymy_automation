import 'server-only'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { investmentIdFor, isInvestmentLocked, type LockTargetKindT } from '@/lib/db/investment-lock'
import type { SessionUserT } from '@/types/auth'
import type { ActionResultT } from '@/types/action'
import type { CACHE_TAGS } from '@/lib/cache/tags'

/**
 * Refuse every write that moves money on a settled investment. The kosztorys writes raw SQL in a
 * dozen places, so neither collection hooks nor Payload `access` see those writes — the action layer
 * is the only chokepoint that does. Wrapping `protectedAction` (the shape `ownerOnlyAction` already
 * uses) runs the check structurally, so a newly added kosztorys action cannot forget a hand-copied
 * `if`. Unlike role gates this one is stateful: it narrows on the investment's status, not on who is
 * asking — no role edits a completed investment.
 */
export type LockTargetT = { investmentId: number } | { kind: LockTargetKindT; id: number }

export const INVESTMENT_LOCKED_MESSAGE =
  'Inwestycja jest zakończona i tylko do odczytu. Aby ją zmienić, ustaw jej status na „Aktywna".'

const TARGET_MISSING: Record<LockTargetKindT, string> = {
  item: 'Pozycja nie istnieje.',
  section: 'Sekcja nie istnieje.',
  stage: 'Etap nie istnieje.',
}

export function investmentAction<TData = undefined>(
  label: string,
  target: LockTargetT,
  handler: (ctx: { payload: Payload; user: SessionUserT }) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
  opts?: { deferRefresh?: boolean },
): Promise<ActionResultT<TData>> {
  return protectedAction<TData>(
    label,
    async (ctx) => {
      const db = await getDb(ctx.payload)

      let investmentId: number | undefined
      if ('investmentId' in target) {
        investmentId = target.investmentId
      } else {
        investmentId = await investmentIdFor(db, target.kind, target.id)
        if (investmentId === undefined) {
          return { success: false, error: TARGET_MISSING[target.kind] } as ActionResultT<TData>
        }
      }

      if (await isInvestmentLocked(db, investmentId)) {
        return { success: false, error: INVESTMENT_LOCKED_MESSAGE } as ActionResultT<TData>
      }
      return handler(ctx)
    },
    revalidate,
    opts,
  )
}
