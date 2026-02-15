import type { RoleT } from '@/lib/auth/roles'

export type UserRowT = {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role: RoleT
  readonly saldo: number
}
