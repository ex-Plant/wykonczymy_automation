import type { GlobalConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'

// The starting point every investment inherits until it stores its own settings. A global rather
// than a seeded row per investment: the firm-wide default has to be one thing that can change after
// the fact, and a seeded copy would freeze each investment at whatever the default was that day.
export const KosztorysClientViewDefaults: GlobalConfig = {
  slug: 'kosztorys-client-view-defaults',
  label: { en: 'Client View Defaults', pl: 'Domyślne ustawienia podglądu inwestora' },
  admin: { group: { en: 'Kosztorys', pl: 'Kosztorys' } },
  access: {
    read: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
  },
  fields: [
    // Which variant an investment WITHOUT a row of its own serves — a firm-wide switch, so the
    // editor never writes it: „Zapisz jako domyślne" saves the column set of the variant in front of
    // the owner, and flipping every client link at once stays a deliberate act here in /admin.
    {
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'OFFER',
      options: [
        { value: 'OFFER', label: { en: 'Offer', pl: 'Oferta' } },
        { value: 'SETTLEMENT', label: { en: 'Settlement', pl: 'Rozliczenie' } },
      ],
    },
    {
      name: 'variants',
      type: 'json',
      defaultValue: {},
    },
  ],
}
