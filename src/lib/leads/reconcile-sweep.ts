import type { Payload } from 'payload'
import { listLeadForms, fetchRecentLeads } from './fetch-recent-leads'
import { fetchFormQuestions } from './fetch-form-questions'
import { leadSchema } from './lead-schema'
import { normalizeLead } from './normalize-lead'
import { storeLead } from './store-lead'

// How many recent leads to pull per form. Enough to close a delivery gap without
// re-scanning a form's entire history on every run.
const PER_FORM_LIMIT = 30

export type ReconcileSweepResultT = { added: number; scanned: number }

/**
 * Pull the most recent leads from every form and insert any the DB is missing.
 * Reconciles against Meta directly, so it recovers leads dropped by an expired
 * token, an outage, or a mis-pointed webhook (see lessons.md — the webhook's
 * failure mode is silent).
 *
 * Backfill is SILENT by design: it stores via `storeLead` (never `captureLead`)
 * and stamps a fresh row's notify/auto-reply `skipped`. A lead recovered days late
 * must not trigger a "thanks for your inquiry" email, and must never re-send if the
 * webhook later redelivers the same `leadgen_id`.
 *
 * Deliberately free of auth and cache revalidation: the server action and the cron
 * route each supply their own. `updateTag` throws in a Route Handler, so a
 * revalidation baked in here would break one of the two callers at runtime.
 * Throws on a Graph failure — the caller decides what a failure looks like.
 */
export async function runLeadReconcileSweep(payload: Payload): Promise<ReconcileSweepResultT> {
  const forms = await listLeadForms()

  let added = 0
  let scanned = 0

  for (const form of forms) {
    if (form.leadsCount === 0) continue

    const rawLeads = await fetchRecentLeads(form.id, PER_FORM_LIMIT)
    if (rawLeads.length === 0) continue

    // One questions fetch per form — carries Meta's field types for normalizeLead.
    const questions = await fetchFormQuestions(form.id)

    for (const raw of rawLeads) {
      const parsed = leadSchema.safeParse(raw)
      if (!parsed.success) continue
      scanned += 1

      const normalized = normalizeLead(parsed.data.field_data, questions)
      const { lead, created } = await storeLead(
        payload,
        {
          source: 'facebook_lead_ads',
          externalId: parsed.data.id,
          email: normalized.email,
          name: normalized.name,
          phone: normalized.phone,
          rawData: normalized.rawData,
          formQuestions: questions,
          formId: form.id,
          formName: form.name,
          submittedAt: parsed.data.created_time,
        },
        // The afterChange hook's revalidateTag is redundant here — the caller does
        // one revalidation after the whole sweep instead.
        { skipRevalidation: true },
      )

      if (!created) continue

      await payload.update({
        collection: 'leads',
        id: lead.id,
        data: { notifyStatus: 'skipped', autoReplyStatus: 'skipped' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      })
      added += 1
    }
  }

  return { added, scanned }
}
