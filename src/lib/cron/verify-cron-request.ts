import type { NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env/server'

/**
 * Shared gate for every Vercel Cron handler — the schedule lives in `vercel.json`
 * and the platform authenticates itself with `Authorization: Bearer $CRON_SECRET`.
 *
 * Fails closed: an unset secret can't be authenticated against, so it rejects
 * everything rather than waving the request through. One home so a hardening
 * change (timing-safe compare, accepting Vercel's own signature header) lands
 * for all crons at once instead of only the one somebody remembered.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET
  if (!secret) return false

  return request.headers.get('authorization') === `Bearer ${secret}`
}
