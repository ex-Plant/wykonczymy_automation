import type { CollectionBeforeDeleteHook, CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import {
  SETTLEMENT_MODE_ADMIN_OPTIONS,
  SETTLEMENT_MODE_DEFAULT,
} from '@/lib/kosztorys/settlement-mode'

const STATUS_OPTIONS = [
  { label: { en: 'Planned', pl: 'Planowana' }, value: 'planowana' },
  { label: { en: 'Active', pl: 'Aktywna' }, value: 'active' },
  { label: { en: 'Completed', pl: 'Zakończona' }, value: 'completed' },
] as const

// Block deletion while any transaction still points here. The FK is ON DELETE SET NULL, so a delete
// does not fail — it silently strips `investment_id` from every referencing row, and nothing records
// which investment they belonged to. For LABOR_COST / RABAT / LOSS that is terminal: they carry no
// source register either, so an orphaned row is reachable from no investment and no kasa at all.
// Cancelled rows count — they are the audit trail, and orphaning them erases it just as thoroughly.
const preventDeleteWithTransactions: CollectionBeforeDeleteHook = async ({ id, req }) => {
  // limit: 1 — only totalDocs is read; Payload computes it via a separate count query, so
  // a single-row page still yields the true total without hydrating every referencing row.
  // `req` is forwarded so the count joins the delete's transaction: a caller that clears the
  // transactions and the investment in one transaction must not be refused on pre-delete state.
  const { totalDocs } = await req.payload.find({
    collection: 'transactions',
    where: { investment: { equals: id } },
    limit: 1,
    req,
  })

  if (totalDocs > 0) {
    throw new Error(
      `Nie można usunąć inwestycji — istnieje ${totalDocs} powiązanych transakcji. Najpierw usuń lub przenieś transakcje.`,
    )
  }
}

export const Investments: CollectionConfig = {
  slug: 'investments',
  labels: {
    singular: { en: 'Investment', pl: 'Inwestycja' },
    plural: { en: 'Investments', pl: 'Inwestycje' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    beforeDelete: [preventDeleteWithTransactions],
    afterChange: [makeRevalidateAfterChange('investments')],
    afterDelete: [makeRevalidateAfterDelete('investments')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
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
      name: 'address',
      type: 'text',
      label: { en: 'Address', pl: 'Adres' },
    },
    {
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', pl: 'Telefon' },
    },
    {
      name: 'email',
      type: 'email',
      label: { en: 'Email', pl: 'Email' },
    },
    {
      name: 'contactPerson',
      type: 'text',
      label: { en: 'Contact Person', pl: 'Osoba kontaktowa' },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: { en: 'Notes', pl: 'Notatki' },
    },
    {
      name: 'review',
      type: 'textarea',
      label: { en: 'Review', pl: 'Opinia' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      label: { en: 'Status', pl: 'Status' },
      options: [...STATUS_OPTIONS],
    },
    // Global (per-investment) subcontractor markup coefficients — the defaults for the sheet;
    // a section may override them, and an item may override them. Columns created in a migration with defaults.
    {
      name: 'wToolsCoeff',
      type: 'number',
      defaultValue: DEFAULT_COEFFS.wTools,
      label: {
        en: 'Subcontractor coeff (with tools)',
        pl: 'Współczynnik podwykonawcy (z narzędziami)',
      },
    },
    {
      name: 'ownToolsCoeff',
      type: 'number',
      defaultValue: DEFAULT_COEFFS.ownTools,
      label: {
        en: 'Subcontractor coeff (own tools)',
        pl: 'Współczynnik podwykonawcy (bez narzędzi)',
      },
    },
    // Per-investment VAT rate, stored as a fraction (0.08 = 8%). Kosztorys prices are netto;
    // brutto is computed. Edited from the kosztorys editor (Sekcje panel), not typically here.
    {
      name: 'vatRate',
      type: 'number',
      defaultValue: DEFAULT_VAT,
      label: { en: 'VAT rate (fraction)', pl: 'Stawka VAT (ułamek)' },
    },
    // Edited from the kosztorys editor's Podsumowanie panel, not typically here. `required` pairs
    // with the column's NOT NULL: without it Payload lets the admin clear the select, and the write
    // surfaces as a raw constraint violation instead of a field error.
    {
      name: 'settlementMode',
      type: 'select',
      required: true,
      defaultValue: SETTLEMENT_MODE_DEFAULT,
      label: { en: 'Settlement mode', pl: 'Sposób rozliczenia' },
      options: SETTLEMENT_MODE_ADMIN_OPTIONS,
    },
    // Materiały billed to the investor at netto instead of the brutto receipt, stored as a fraction
    // (0.23 = 23%) like `vatRate` above. Deliberately neither `required` nor defaulted: null means
    // "no concession" and must stay distinguishable from a 0% one, since that is what leaves every
    // existing investment's figures untouched. Edited from the Podsumowanie panel, not typically here.
    {
      name: 'materialsNetRate',
      type: 'number',
      label: { en: 'Materials net rate (fraction)', pl: 'Stawka netto wydatków (ułamek)' },
    },
    // Global kosztorys discount: amount-only ('amount' | null). Overrides per-item discounts and is
    // subtracted once from the executed total. `type` null = no global discount (per-item discounts
    // apply). A percent global rabat is no longer stored — it's stamped into each per-item rabat.
    // Edited from the kosztorys editor settings bar, not typically here.
    {
      name: 'globalDiscountType',
      type: 'text',
      label: { en: 'Global discount type', pl: 'Rabat globalny — typ' },
    },
    {
      name: 'globalDiscountValue',
      type: 'number',
      defaultValue: 0,
      label: { en: 'Global discount value', pl: 'Rabat globalny — wartość' },
    },
  ],
}
