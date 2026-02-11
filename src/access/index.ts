import type { Access, FieldAccess, PayloadRequest } from 'payload'
import type { RoleT } from '@/collections/users'

type UserWithRole = {
  id: number
  role?: RoleT
} | null | undefined

const hasRole = (user: UserWithRole, role: RoleT): boolean =>
  user?.role === role

const hasAnyRole = (user: UserWithRole, ...roles: RoleT[]): boolean =>
  roles.some((role) => hasRole(user, role))

// --- Boolean-only access (for `admin`, `unlock`, field-level) ---

type BooleanAccess = ({ req }: { req: PayloadRequest }) => boolean

export const isAdminBoolean: BooleanAccess = ({ req: { user } }) =>
  hasRole(user, 'ADMIN')

// --- Collection-level access (can return boolean | Where) ---

export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'ADMIN')

export const isAdminOrOwner: Access = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER')

export const isAdminOrOwnerOrManager: Access = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER', 'MANAGER')

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const isAdminOrSelf: Access = ({ req: { user }, id }) => {
  if (hasAnyRole(user, 'ADMIN', 'OWNER')) return true
  return user?.id === id
}

// --- Field-level access ---

export const isAdminField: FieldAccess = ({ req: { user } }) => hasRole(user, 'ADMIN')

export const isAdminOrOwnerField: FieldAccess = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER')
