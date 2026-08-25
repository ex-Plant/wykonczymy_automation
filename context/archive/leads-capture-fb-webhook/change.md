---
id: leads-capture-fb-webhook
title: Lead capture — HMAC-verified FB Lead Ads webhook → leads collection + table view
status: done
created: 2026-07-06
updated: 2026-07-08
---

# Lead capture — FB Lead Ads → centralized leads store

First buildable increment of the centralized interaction store. Turns the existing
console-logging FB Lead Ads webhook into a resilient capture path: HMAC signature
verification, a source-agnostic `leads` Payload collection (append-only event log),
type-driven field extraction with a Zod safety net, store-then-notify (a mail failure
can never lose a lead), and a frontend leads table with an editable follow-up status.

**Shipped beyond the original plan** (2026-07-07): lead-facing branded auto-reply
(`LEADS_REPLY_FROM`, retried 3×, `autoReplyStatus`); `formQuestions` key→label map +
details modal at `/zgloszenia` rendering each answer against its real question; webhook
key-heuristic field extraction; contact-status UI polish (Oczekuje label, header tooltips).
DB: migration `20260707_1_add_lead_form_questions` (apply to prod before deploy).

**Excluded (deliberately deferred):** `clients` collection (direction chosen = option B,
built later), Sentry, notification bell + websockets, cron sweeper for `notifyStatus`/
`autoReplyStatus != 'sent'` (retry email out-of-band).

Design: `context/reference/superpowers/archive/2026-07-06-leads-capture-design.md`
Reference: `context/reference/facebook-leads-setup.md` (webhook/token/backfill/data-shape)

## Kept from the plan (deleted 2026-08-08)

- **Extraction is type-driven, not label-driven.** `EMAIL` / `PHONE` / `FULL_NAME` are lifted by Meta's
  field **type** (from the form's `questions` key→type map), with an email-regex fallback on values when
  the typed field is absent, and everything kept verbatim in `rawData`. Only Meta-typed fields are safe
  as columns — a `CUSTOM` field's label is per-form free text and can't back a schema. Proven against a
  62-lead dump. `values` is always an array; read `values[0]`, never assume a scalar.
- **A missing email must never throw or drop** — it returns an emailless result and fires the safety-net
  alert. Silent loss was the whole risk this change existed to close.
- **`clients` deferred on a direction, not on effort**: an investment is not a client identity, so the
  lead→client link waits until leads actually flow (option B).
- Generalisations extracted to `context/foundation/lessons.md`: HMAC over raw request bytes, and Payload
  compound-uniqueness via a raw index.
