import type { CollectionConfig } from 'payload'
import {
  isAdminBoolean,
  isAdminOrOwner,
  isAdminOrOwnerField,
  isAdminOrSelf,
  rolesOrSelfField,
} from '@/access'

export const ROLES = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'] as const
export type RoleT = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleT, { en: string; pl: string }> = {
  ADMIN: { en: 'Admin', pl: 'Admin' },
  OWNER: { en: 'Owner', pl: 'Właściciel' },
  MANAGER: { en: 'Manager', pl: 'Majster' },
  EMPLOYEE: { en: 'Employee', pl: 'Pracownik' },
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  labels: {
    singular: { en: 'User', pl: 'Użytkownik' },
    plural: { en: 'Users', pl: 'Użytkownicy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: { en: 'Admin', pl: 'Administracja' },
  },
  access: {
    read: rolesOrSelfField('id', 'ADMIN', 'OWNER', 'MANAGER'),
    create: isAdminOrOwner,
    update: isAdminOrSelf,
    delete: isAdminOrOwner,
    // Only ADMIN gets Payload admin panel access
    admin: isAdminBoolean,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Imię i nazwisko' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'EMPLOYEE',
      label: { en: 'Role', pl: 'Rola' },
      options: ROLES.map((role) => ({
        label: ROLE_LABELS[role],
        value: role,
      })),
      saveToJWT: true,
      access: {
        // Only ADMIN/OWNER can change roles
        update: isAdminOrOwnerField,
      },
    },
  ],
}
