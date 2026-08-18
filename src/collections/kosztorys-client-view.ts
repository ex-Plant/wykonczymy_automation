import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'

// What one investment's client sees. Its own table for the same reason `kosztorys-shares` is one:
// `kosztoryses` is the v1 Google-Sheet link row (required `googleSheetId`), so a v2 kosztorys has no
// row there at all, and a client-disclosure decision is not a property of the investment record.
//
// `hiddenColumns` stores what is HIDDEN, not what is visible: `PREVIEW_VISIBLE_COLUMNS` stays the
// ceiling, so a column added to the allowlist later is served without rewriting a single stored row.
export const KosztorysClientView: CollectionConfig = {
  slug: 'kosztorys-client-view',
  labels: {
    singular: { en: 'Kosztorys Client View', pl: 'Ustawienia podglądu inwestora' },
    plural: { en: 'Kosztorys Client Views', pl: 'Ustawienia podglądu inwestora' },
  },
  admin: {
    useAsTitle: 'investment',
    defaultColumns: ['investment', 'hideEmptyRows', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  // No revalidation hooks: the settings are read outside the preview's `unstable_cache` entry, so a
  // save is live on the next request and no tag holds a copy for a write to bust.
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwner,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  timestamps: true,
  fields: [
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      required: true,
      unique: true,
    },
    {
      name: 'hiddenColumns',
      type: 'json',
      defaultValue: [],
    },
    {
      name: 'hideEmptyRows',
      type: 'checkbox',
      required: true,
      defaultValue: true,
    },
  ],
}
