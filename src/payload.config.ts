import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { pl } from '@payloadcms/translations/languages/pl'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { CashRegisters } from '@/collections/cash-registers'
import { Investments } from '@/collections/investments'
import { Media } from '@/collections/media'
import { OtherCategories } from '@/collections/other-categories'
import { Users } from '@/collections/users'
import { seed } from '@/seed'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  i18n: {
    supportedLanguages: { pl, en },
    fallbackLanguage: 'pl',
  },
  editor: lexicalEditor(),
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  collections: [Users, CashRegisters, Investments, OtherCategories, Media],
  onInit: seed,
  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-ENV',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
