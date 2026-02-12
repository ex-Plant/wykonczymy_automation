import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager, rolesOrSelfField } from '@/access'
import { validateTransaction } from '@/hooks/transactions/validate'
import { recalcAfterChange, recalcAfterDelete } from '@/hooks/transactions/recalculate-balances'

const TRANSACTION_TYPES = [
  { label: { en: 'Investment Expense', pl: 'Wydatek inwestycyjny' }, value: 'INVESTMENT_EXPENSE' },
  { label: { en: 'Advance', pl: 'Zaliczka' }, value: 'ADVANCE' },
  { label: { en: 'Employee Expense', pl: 'Wydatek pracowniczy' }, value: 'EMPLOYEE_EXPENSE' },
  { label: { en: 'Other', pl: 'Inne' }, value: 'OTHER' },
] as const

const PAYMENT_METHODS = [
  { label: { en: 'Cash', pl: 'Gotówka' }, value: 'CASH' },
  { label: { en: 'BLIK', pl: 'BLIK' }, value: 'BLIK' },
  { label: { en: 'Transfer', pl: 'Przelew' }, value: 'TRANSFER' },
  { label: { en: 'Card', pl: 'Karta' }, value: 'CARD' },
] as const

/** Show field when type includes investment */
const needsInvestment = (data: Record<string, unknown>) =>
  data?.type === 'INVESTMENT_EXPENSE' || data?.type === 'EMPLOYEE_EXPENSE'

/** Show field when type includes worker */
const needsWorker = (data: Record<string, unknown>) =>
  data?.type === 'ADVANCE' || data?.type === 'EMPLOYEE_EXPENSE'

/** Show field when type is OTHER */
const needsOtherCategory = (data: Record<string, unknown>) => data?.type === 'OTHER'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  labels: {
    singular: { en: 'Transaction', pl: 'Transakcja' },
    plural: { en: 'Transactions', pl: 'Transakcje' },
  },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'amount', 'type', 'date', 'cashRegister'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: rolesOrSelfField('worker', 'ADMIN', 'OWNER', 'MANAGER'),
    create: isAdminOrOwnerOrManager,
    update: rolesOrSelfField('createdBy', 'ADMIN', 'OWNER'),
    delete: isAdminOrOwner,
  },
  hooks: {
    beforeValidate: [validateTransaction],
    afterChange: [recalcAfterChange],
    afterDelete: [recalcAfterDelete],
  },
  fields: [
    {
      name: 'description',
      type: 'text',
      required: true,
      label: { en: 'Description', pl: 'Opis' },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0.01,
      label: { en: 'Amount', pl: 'Kwota' },
      admin: {
        description: {
          en: 'Always positive — direction is determined by type',
          pl: 'Zawsze dodatnia — kierunek wynika z typu',
        },
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: { en: 'Date', pl: 'Data' },
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: { en: 'Type', pl: 'Typ' },
      options: [...TRANSACTION_TYPES],
    },
    {
      name: 'paymentMethod',
      type: 'select',
      required: true,
      label: { en: 'Payment Method', pl: 'Metoda płatności' },
      options: [...PAYMENT_METHODS],
    },
    {
      name: 'cashRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      required: true,
      label: { en: 'Cash Register', pl: 'Kasa' },
    },
    // --- Conditional fields based on type ---
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      label: { en: 'Investment', pl: 'Inwestycja' },
      admin: {
        condition: (data) => needsInvestment(data),
      },
    },
    {
      name: 'worker',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Worker', pl: 'Pracownik' },
      admin: {
        condition: (data) => needsWorker(data),
      },
    },
    {
      name: 'otherCategory',
      type: 'relationship',
      relationTo: 'other-categories',
      label: { en: 'Category', pl: 'Kategoria' },
      admin: {
        condition: (data) => needsOtherCategory(data),
      },
    },
    {
      name: 'otherDescription',
      type: 'textarea',
      label: { en: 'Category Description', pl: 'Opis kategorii' },
      admin: {
        condition: (data) => needsOtherCategory(data),
      },
    },
    // --- Invoice documentation ---
    {
      name: 'invoice',
      type: 'upload',
      relationTo: 'media',
      label: { en: 'Invoice', pl: 'Faktura' },
    },
    {
      name: 'invoiceNote',
      type: 'textarea',
      label: { en: 'Invoice Note', pl: 'Notatka do faktury' },
      admin: {
        description: {
          en: 'Required if no invoice file is attached',
          pl: 'Wymagane jeśli nie załączono faktury',
        },
      },
    },
    // --- Metadata ---
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Created By', pl: 'Utworzone przez' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
