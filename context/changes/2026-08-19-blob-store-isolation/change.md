---
change_id: blob-store-isolation
title: Point local dev at the preview Blob store so non-prod can't delete real invoices
status: implemented
created: 2026-08-19
updated: 2026-08-19
archived_at: null
branch: konradantonik/blob-store-isolation
worktree: null
---

## Notes

Przepięcie lokalnego dev (i domknięcie środowiska Development na Vercelu) z produkcyjnego Vercel
Blob store na preview store — izolacja produkcyjnych faktur od kasowania z localhosta.

Why it matters (established while closing EX-459, 2026-08-19):

- Local `.env` carries the **production** store token (`vercel_blob_rw_oJHLWhvHKJrsgWiN_…`).
- The local DB is a restored prod dump, so `media.filename` values are the real invoices.
- Three live delete paths reach `del()` on that store: `src/hooks/transfers/delete-invoice-media.ts`
  (afterDelete on an expense), `src/lib/invoices/delete-unreferenced-media.ts`,
  `src/lib/utils/discard-orphaned-uploads.ts` — via the plugin's `handleDelete`.
- Blob has no versioning and no undelete. So deleting a test expense on localhost **permanently
  destroys a real, tax-retained faktura** (~5yr retention).
- Databases are already isolated per environment (prod Neon / dev 5433 / e2e 5435). The Blob store
  is the one shared plane, and that is an inconsistency, not a decision.

Already done, not part of this change: **Preview/staging is switched** — the Preview env resolves
`BLOB_READ_WRITE_TOKEN` to the preview store `store_rNjU0fDb7Sz8bHVA` (`vercel env pull` confirms).
Remaining: local `.env` + the Development environment variable on Vercel.

Known cost to design around: the preview store is a point-in-time restore (2347 files, 2026-08-19).
A newer `pnpm db:import` will reference invoices uploaded to prod after that, which will 404 locally.
Top-up is already tooled — `scripts/blob-restore.mjs --skip-existing` against the preview token,
fed by the nightly FTP mirror, uploads only the delta.

Backdrop: `context/changes/blob-backup/runbook.md` (EX-459), incl. why the prod token must never
be pasted into a non-prod shell again.
