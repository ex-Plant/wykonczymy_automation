import {
  canUpdateUser,
  isAdminOrOwner,
  isAdminOrOwnerOrManagerBoolean,
  isAdminOrOwnerField,
  isAdminOrOwnerOrManager,
} from '@/access'
import { forgotPasswordEmailHTML } from '@/lib/email/forgot-password-template'
import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'

// Block a hard delete while a FIGURE or its audit trail still names this person. Every reference to
// `users` is ON DELETE SET NULL, so the delete does not fail — it strips the attribution and leaves
// the row: a wypłata whose recipient is unknown, an amount edit with no editor, an etap with no
// podwykonawca. Deactivation (`active`) is the intended way for someone to leave; it keeps the row,
// so every past figure still says who it was about.
// Plain authorship is deliberately NOT a blocker — a media uploader, a snapshot's `takenBy`, a
// preset's `createdBy` name who touched something, not what a złotówka means, and blocking on them
// would freeze an account after one upload.
const preventDeleteWithReferences: CollectionBeforeDeleteHook = async ({ id, req }) => {
  // limit: 1 — only totalDocs is read; Payload computes it via a separate count query, so
  // a single-row page still yields the true total without hydrating every referencing row.
  // `req` is forwarded so each count joins the delete's transaction: a caller that clears the
  // referencing rows and the user in one transaction must not be refused on pre-delete state.
  const [transactions, amountEdits, registers, stages] = await Promise.all([
    req.payload.find({
      collection: 'transactions',
      where: {
        or: [
          { worker: { equals: id } },
          { createdBy: { equals: id } },
          { updatedBy: { equals: id } },
        ],
      },
      limit: 1,
      req,
    }),
    req.payload.find({
      collection: 'amount-edits',
      where: { editedBy: { equals: id } },
      limit: 1,
      req,
    }),
    req.payload.find({
      collection: 'cash-registers',
      where: { owner: { equals: id } },
      limit: 1,
      req,
    }),
    req.payload.find({
      collection: 'kosztorys-stages',
      where: { worker: { equals: id } },
      limit: 1,
      req,
    }),
  ])

  const blockers = [
    transactions.totalDocs > 0 && `transakcje: ${transactions.totalDocs}`,
    amountEdits.totalDocs > 0 && `zmiany kwot: ${amountEdits.totalDocs}`,
    registers.totalDocs > 0 && `kasy: ${registers.totalDocs}`,
    stages.totalDocs > 0 && `etapy kosztorysu: ${stages.totalDocs}`,
  ].filter((entry): entry is string => Boolean(entry))

  if (blockers.length > 0) {
    throw new Error(
      `Nie można usunąć pracownika — jest powiązany z danymi (${blockers.join(', ')}). Zamiast usuwać, odznacz „Aktywny".`,
    )
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 604800, // 7 days until app logs you out
    forgotPassword: {
      generateEmailHTML: (args) => {
        return forgotPasswordEmailHTML({
          token: args?.token ?? '',
          userName: (args?.user as { name?: string })?.name,
        })
      },
      generateEmailSubject: () => 'Resetowanie hasła — Wykonczymy',
    },
  },
  hooks: {
    beforeDelete: [preventDeleteWithReferences],
    afterChange: [makeRevalidateAfterChange('users')],
    afterDelete: [makeRevalidateAfterDelete('users')],
  },
  labels: {
    singular: { en: 'Employee', pl: 'Pracownik' },
    plural: { en: 'Employees', pl: 'Pracownicy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: { en: 'Admin', pl: 'Administracja' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: canUpdateUser,
    delete: isAdminOrOwner,
    admin: isAdminOrOwnerOrManagerBoolean,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      saveToJWT: true,
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
        // Only ADMIN/OWNER can set or change roles
        // MANAGER creating a user → field not writable → defaults to EMPLOYEE
        create: isAdminOrOwnerField,
        update: isAdminOrOwnerField,
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: { en: 'Active', pl: 'Aktywny' },
      access: {
        create: isAdminOrOwnerField,
        update: isAdminOrOwnerField,
      },
    },
    {
      name: 'defaultCashRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Default Cash Register', pl: 'Domyślna kasa' },
    },
  ],
}
