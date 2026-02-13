import type { RoleT } from '@/collections/users'

export type UserRowT = {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role: RoleT
  readonly saldo: number
}
