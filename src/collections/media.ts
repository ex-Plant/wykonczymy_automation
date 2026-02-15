import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager, rolesOrSelfField } from '@/access'

/** Replace characters that break next/image optimization URLs */
function sanitizeFilename(name: string): string {
  return name.replace(/\s+/g, '-').replace(/[()]/g, '')
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: { en: 'Media', pl: 'Plik' },
    plural: { en: 'Media', pl: 'Pliki' },
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (req.file?.name) {
          req.file.name = sanitizeFilename(req.file.name)
        }
        if (data.filename) {
          data.filename = sanitizeFilename(data.filename)
        }
        return data
      },
    ],
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  admin: {
    defaultColumns: ['filename', 'alt', 'createdAt'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: rolesOrSelfField('createdBy', 'ADMIN', 'OWNER', 'MANAGER'),
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: { en: 'Alt Text', pl: 'Tekst alternatywny' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Uploaded By', pl: 'Przesłane przez' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [({ req, value }) => req.user?.id ?? value],
      },
    },
  ],
}
