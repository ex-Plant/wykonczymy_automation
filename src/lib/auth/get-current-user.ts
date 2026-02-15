import 'server-only'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { RoleT } from '@/lib/auth/roles'

export type SessionUserT = {
  id: number
  email: string
  name: string
  role: RoleT
}

export async function getCurrentUser(): Promise<SessionUserT | undefined> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })

  if (!user) return undefined

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}
