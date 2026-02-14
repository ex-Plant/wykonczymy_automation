import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager, isAdminOrOwnerField } from '@/access'

export const CashRegisters: CollectionConfig = {
  slug: 'cash-registers',
  labels: {
    singular: { en: 'Cash Register', pl: 'Kasa' },
    plural: { en: 'Cash Registers', pl: 'Kasy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'owner', 'balance'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    // ADMIN/OWNER: full CRUD. MANAGER: read all.
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwner,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: { en: 'Owner', pl: 'Właściciel' },
    },
    {
      name: 'balance',
      type: 'number',
      defaultValue: 0,
      label: { en: 'Balance', pl: 'Saldo' },
      admin: {
        readOnly: true,
        description: {
          en: 'Updated automatically via transactions',
          pl: 'Aktualizowane automatycznie przez transakcje',
        },
      },
      access: {
        // Only ADMIN/OWNER can manually override balance
        update: isAdminOrOwnerField,
      },
    },
  ],
}
