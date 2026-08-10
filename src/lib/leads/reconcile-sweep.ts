import type { Payload } from 'payload'
import { listLeadForms, fetchRecentLeads } from './fetch-recent-leads'
import { fetchFormQuestions } from './fetch-form-questions'
import { leadSchema } from './lead-schema'
import { normalizeLead } from './normalize-lead'
import { storeLead } from './store-lead'

// 30 is enough to close a delivery gap without re-scanning a form's entire history.
const PER_FORM_LIMIT = 30

export type ReconcileSweepResultT = {
  added: number
  scanned: number
  /** Forms whose Graph calls threw; the rest of the sweep still ran. */
  failedForms: string[]
  /** Forms that filled a whole `PER_FORM_LIMIT` page — older leads may lie past it. */
  saturatedForms: string[]
}

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
 *
 * Partial failure is reported, not thrown: one form's rate-limit must not discard
 * the leads already recovered from earlier forms, nor skip the forms after it —
 * form order is stable, so a throw here would mean the tail is never swept on any
 * day. Only a failure to list the forms at all throws.
 */
export async function runLeadReconcileSweep(payload: Payload): Promise<ReconcileSweepResultT> {
  const forms = await listLeadForms()

  let added = 0
  let scanned = 0
  const failedForms: string[] = []
  const saturatedForms: string[] = []

  for (const form of forms) {
    if (form.leadsCount === 0) continue

    try {
      const rawLeads = await fetchRecentLeads(form.id, PER_FORM_LIMIT)
      if (rawLeads.length === 0) continue

      // A full page means the window, not the backlog, decided where we stopped —
      // the leads past it are unreachable and tomorrow's page is a newer set, so
      // they would be lost silently. The caller surfaces this in the alert.
      if (rawLeads.length >= PER_FORM_LIMIT) saturatedForms.push(form.id)

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
    } catch (err) {
      // TODO(EX-449) SENTRY-REQUIRED: a form the sweep can never read is a permanent hole.
      console.error(`[reconcile-sweep] Form ${form.id} failed`, err)
      failedForms.push(form.id)
    }
  }

  return { added, scanned, failedForms, saturatedForms }
}
