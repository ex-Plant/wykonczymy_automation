import { describe, expect, it } from 'vitest'

import { PROD_BLOB_STORE_ID, serverSchema } from '@/lib/env/schema'

const PROD_TOKEN = `vercel_blob_rw_${PROD_BLOB_STORE_ID}_aaaaaaaaaaaaaaaaaaaaaaaaaaaa`
const PREVIEW_TOKEN = 'vercel_blob_rw_rNjU0fDb7Sz8bHVA_bbbbbbbbbbbbbbbbbbbbbbbbbbbb'

// Everything the schema demands apart from the field under test, so a failure names the guard
// rather than an unrelated missing var.
const baseEnv = {
  DB_POSTGRES_URL: 'postgres://user:pass@localhost:5433/db',
  PAYLOAD_SECRET: 'secret',
  BLOB_READ_WRITE_TOKEN: PREVIEW_TOKEN,
  EMAIL_USER: 'user',
  EMAIL_PASS: 'pass',
  EMAIL_HOST: 'smtp.example.com',
  META_APP_SECRET: 'x',
  META_APP_ID: 'x',
  META_APP_TOKEN: 'x',
  META_VERIFY_TOKEN: 'x',
  META_PAGE_ACCESS_TOKEN: 'x',
  META_PAGE_ID: 'x',
  WPFORMS_WEBHOOK_SECRET: 'x',
  LEADS_NOTIFY_EMAIL: 'leads@example.com',
  LEADS_ALERT_EMAIL: 'alerts@example.com',
  LEADS_REPLY_FROM: 'reply@example.com',
  FLEET_NOTIFICATION_EMAIL: 'fleet@example.com',
  ADMIN_EMAIL: 'admin@example.com',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'sa@example.iam.gserviceaccount.com',
    private_key: 'key',
  }),
  KOSZTORYS_TEMPLATE_SHEET_ID: 'sheet-id',
  OPENROUTER_API_KEY: 'x',
  CRON_SECRET: 'x',
}

describe('serverSchema — production Blob token guard', () => {
  it('accepts the production store token in production', () => {
    const result = serverSchema.safeParse({
      ...baseEnv,
      BLOB_READ_WRITE_TOKEN: PROD_TOKEN,
      VERCEL_ENV: 'production',
    })

    expect(result.success).toBe(true)
  })

  it('rejects the production store token when VERCEL_ENV is absent (local dev)', () => {
    const result = serverSchema.safeParse({ ...baseEnv, BLOB_READ_WRITE_TOKEN: PROD_TOKEN })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
      'BLOB_READ_WRITE_TOKEN',
    )
  })

  it('rejects the production store token on preview', () => {
    const result = serverSchema.safeParse({
      ...baseEnv,
      BLOB_READ_WRITE_TOKEN: PROD_TOKEN,
      VERCEL_ENV: 'preview',
    })

    expect(result.success).toBe(false)
  })

  it('accepts the preview store token outside production', () => {
    const result = serverSchema.safeParse(baseEnv)

    expect(result.success).toBe(true)
  })
})
