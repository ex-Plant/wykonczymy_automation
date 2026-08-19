import { z } from 'zod'
import isValidUrl from '@/lib/utils/is-valid-url'

// Pure schemas — NO side effects and NO `import 'server-only'`, so this file is safe to
// import from both env entries (env/index.ts / env/server.ts) and from the Payload CLI graph.
// Hard rule: every var is required (no `.default()`) so a missing one fails the build gate;

export const clientSchema = z.object({
  // Public (inlined into the browser bundle) — read via statically-keyed object in env.ts.
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
})

// The production Blob store's id, which a token carries verbatim (`vercel_blob_rw_<STORE_ID>_…`).
// Not a secret — it is also the store's public CDN hostname.
export const PROD_BLOB_STORE_ID = 'oJHLWhvHKJrsgWiN'

export const serverSchema = z
  .object({
    DB_POSTGRES_URL: z.string().min(1),
    PAYLOAD_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    EMAIL_USER: z.string().min(1),
    EMAIL_PASS: z.string().min(1),
    EMAIL_HOST: z.string().min(1),
    // Meta
    META_APP_SECRET: z.string().min(1),
    META_APP_ID: z.string().min(1),
    META_APP_TOKEN: z.string().min(1),
    META_VERIFY_TOKEN: z.string().min(1),
    META_PAGE_ACCESS_TOKEN: z.string().min(1),
    META_PAGE_ID: z.string().min(1),
    WPFORMS_WEBHOOK_SECRET: z.string().min(1),
    LEADS_NOTIFY_EMAIL: z.string().min(1),
    LEADS_ALERT_EMAIL: z.string().min(1),
    LEADS_REPLY_FROM: z.string().min(1),
    // Fleet reminder digest recipients (EX-711) — the digest goes to both, in one send.
    // FLEET_NOTIFICATION_EMAIL points at the same inbox as LEADS_NOTIFY_EMAIL for now;
    // separate vars so the two can be split without touching code.
    FLEET_NOTIFICATION_EMAIL: z.string().min(1),
    ADMIN_EMAIL: z.string().min(1),
    // Google (Sheets + Drive for kosztorys integration)
    GOOGLE_SERVICE_ACCOUNT_JSON: z
      .string()
      .min(1, 'GOOGLE_SERVICE_ACCOUNT_JSON is required')
      .refine((raw) => {
        try {
          const parsed = JSON.parse(raw)
          return typeof parsed?.client_email === 'string' && typeof parsed?.private_key === 'string'
        } catch {
          return false
        }
      }, 'GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON with client_email and private_key'),
    KOSZTORYS_TEMPLATE_SHEET_ID: z.string().min(1, 'KOSZTORYS_TEMPLATE_SHEET_ID is required'),
    KOSZTORYS_DRIVE_FOLDER_ID: z.string().optional(),
    // OpenRouter (receipt-scan vision extraction). Referer/app-name are optional attribution
    // headers OpenRouter surfaces on its dashboard; only the key is required to make calls.
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_HTTP_REFERER: z.string().optional(),
    OPENROUTER_APP_NAME: z.string().optional(),
    // Vercel-injected at runtime; absent locally (where NODE_ENV is the right signal).
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
    CRON_SECRET: z.string().min(1),
  })
  // Local dev runs against a restored prod dump, so `media.filename` values are the REAL invoice
  // keys — a delete on localhost against the production store destroys a tax-retained faktura, and
  // Blob has no undelete. Non-production therefore reads and writes the preview store only; the
  // production token stays reachable to the backup scripts as BLOB_READ_WRITE_TOKEN_PROD.
  // Keyed on VERCEL_ENV, never NODE_ENV: a local `next build` sets NODE_ENV=production and would
  // switch the guard off on the very machine it protects.
  .superRefine((env, ctx) => {
    if (env.VERCEL_ENV === 'production') return
    if (!env.BLOB_READ_WRITE_TOKEN.startsWith(`vercel_blob_rw_${PROD_BLOB_STORE_ID}_`)) return
    ctx.addIssue({
      code: 'custom',
      path: ['BLOB_READ_WRITE_TOKEN'],
      message:
        `refuses to run outside production: this is the PRODUCTION Blob store (${PROD_BLOB_STORE_ID}). ` +
        'Use the preview store token here and keep the production one under BLOB_READ_WRITE_TOKEN_PROD.',
    })
  })
