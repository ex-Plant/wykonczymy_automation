'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'

export async function getRegisterBalance(registerId: number): Promise<{ registerBalance: number }> {
  const elapsed = perfStart()

  const [{ user }, payload] = await Promise.all([
    requireAuth(MANAGEMENT_ROLES),
    getPayload({ config }),
  ])
  if (!user) throw new Error('Brak uprawnień')
  console.log(`[PERF]   requireAuth + getPayload ${elapsed()}ms`)

  const registerBalance = await sumRegisterBalance(payload, registerId)
  console.log(`[PERF] getRegisterBalance(${registerId}) ${elapsed()}ms`)

  return { registerBalance }
}
