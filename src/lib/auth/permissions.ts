import type { RoleT } from '@/collections/users'

const MANAGEMENT_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER', 'MANAGER'] as const

const isManagementRole = (role: RoleT): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(role)

export { MANAGEMENT_ROLES, isManagementRole }
