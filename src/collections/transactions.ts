import type { CollectionConfig } from 'payload'
import { isAdminOrOwner } from '@/access'
import { validateTransaction } from '@/hooks/transactions/validate'
import { recalcAfterChange, recalcAfterDelete } from '@/hooks/transactions/recalculate-balances'

const TRANSACTION_TYPES = [
  { label: { en: 'Investor Deposit', pl: 'Wpłata od inwestora' }, value: 'INVESTOR_DEPOSIT' },
  { label: { en: 'Stage Settlement', pl: 'Rozliczenie etapu' }, value: 'STAGE_SETTLEMENT' },
  { label: { en: 'Company Funding', pl: 'Zasilenie z konta firmowego' }, value: 'COMPANY_FUNDING' },
  { label: { en: 'Other Deposit', pl: 'Inna wpłata' }, value: 'OTHER_DEPOSIT' },
  { label: { en: 'Investment Expense', pl: 'Wydatek inwestycyjny' }, value: 'INVESTMENT_EXPENSE' },
  {
    label: { en: 'Account Funding', pl: 'Zasilenie konta współpracownika' },
    value: 'ACCOUNT_FUNDING',
  },
  { label: { en: 'Employee Expense', pl: 'Wydatek pracowniczy' }, value: 'EMPLOYEE_EXPENSE' },
  {
    label: { en: 'Register Transfer', pl: 'Transfer między kasami' },
    value: 'REGISTER_TRANSFER',
  },
  { label: { en: 'Other', pl: 'Inne' }, value: 'OTHER' },
] as const

const PAYMENT_METHODS = [
  { label: { en: 'Cash', pl: 'Gotówka' }, value: 'CASH' },
  { label: { en: 'BLIK', pl: 'BLIK' }, value: 'BLIK' },
  { label: { en: 'Transfer', pl: 'Przelew' }, value: 'TRANSFER' },
  { label: { en: 'Card', pl: 'Karta' }, value: 'CARD' },
] as const

/** Show cashRegister for all types except EMPLOYEE_EXPENSE */
const showCashRegister = (data: Record<string, unknown>) => data?.type !== 'EMPLOYEE_EXPENSE'

/** Show investment field for types that use it (required or optional) */
const showInvestment = (data: Record<string, unknown>) =>
  data?.type === 'INVESTOR_DEPOSIT' ||
  data?.type === 'STAGE_SETTLEMENT' ||
  data?.type === 'INVESTMENT_EXPENSE' ||
  data?.type === 'EMPLOYEE_EXPENSE'

/** Show field when type includes worker */
const needsWorker = (data: Record<string, unknown>) =>
  data?.type === 'ACCOUNT_FUNDING' || data?.type === 'EMPLOYEE_EXPENSE'

/** Show targetRegister only for REGISTER_TRANSFER */
const showTargetRegister = (data: Record<string, unknown>) => data?.type === 'REGISTER_TRANSFER'

/** Show field when type is OTHER */
const needsOtherCategory = (data: Record<string, unknown>) => data?.type === 'OTHER'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  labels: {
    singular: { en: 'Transfer', pl: 'Transfer' },
    plural: { en: 'Transfers', pl: 'Transfery' },
  },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'amount', 'type', 'date', 'cashRegister'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: isAdminOrOwner,
    create: isAdminOrOwner,
    update: isAdminOrOwner,
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
      required: false,
      label: { en: 'Cash Register', pl: 'Kasa' },
      admin: {
        condition: (data) => showCashRegister(data),
      },
    },
    {
      name: 'targetRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Target Register', pl: 'Kasa docelowa' },
      admin: {
        condition: (data) => showTargetRegister(data),
      },
    },
    // --- Conditional fields based on type ---
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      label: { en: 'Investment', pl: 'Inwestycja' },
      admin: {
        condition: (data) => showInvestment(data),
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
