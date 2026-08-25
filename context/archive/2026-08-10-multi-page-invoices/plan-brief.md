# Plan Brief: Multi-page invoices (EX-659)

**Change**: `multi-page-invoices` · **Date**: 2026-08-10 · **Full plan**: `plan.md`

## The Problem

A long invoice needs 2–3 photos to be readable, but an expense can hold exactly one file. Today the
user either photographs a page and loses the rest, or splits one invoice across several expenses and
corrupts the figures. This hits both the AI scan flow and hand entry.

## The Shape of the Solution

`transactions.invoice` becomes `hasMany`. One expense, one ordered list of pages. Everything else
follows from that: the scan reads all pages in a single model call so the total is found wherever the
vendor printed it, and every surface that shows, exports or edits an invoice learns to handle a list.

The user declares intent **before** scanning by choosing an entry point — the existing button still
means "one photo, one expense"; a new button means "these photos are one invoice". No post-hoc
grouping gesture, no guessing.

## Key Decisions

| Decision            | Choice                                                                                                                                                      | Source      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Data model          | `hasMany` list, not first-file-plus-extras — replace/remove of a saved invoice is real, and the two-headed model would need two removal verbs in one widget | Frame       |
| Row DTO             | A real `invoices[]` array, not "first page + count" — ZIP, CSV and the preview pager all need every URL                                                     | Plan        |
| Migration           | Hand-written join table `transactions_rels`; create → backfill → verify count → drop the column. This is **production data**                                | Research    |
| Scan architecture   | **One** model call over all pages — reverses EX-443's "one call per image"                                                                                  | Plan        |
| Scan location       | Moves from server action to an API route — a multi-page body exceeds the 4.5MB action cap                                                                   | Plan        |
| Grouping affordance | A **second button** ("one expense from many photos"); the existing button is untouched                                                                      | User        |
| Drag & drop         | Two labelled drop zones matching the two buttons                                                                                                            | User        |
| Page limit          | **None** — the invoice format is the vendor's. The model timeout scales per page instead                                                                    | User + Plan |
| Edit scope          | Both the transfers table and the edit form handle the list                                                                                                  | User        |
| Removal             | Per page **and** remove-all                                                                                                                                 | User        |
| Preview             | One dialog paging through the document; print and download cover the whole set                                                                              | User        |
| CSV / print         | All links in the „Faktura" cell — one of three would look like a complete set                                                                               | Plan        |
| ZIP                 | Every page, deduped names; the rows-vs-files tally gets split so it stops printing „Pobrano 9 z 5"                                                          | Plan        |
| Blob cleanup        | Fix all three existing leak paths in this change — we rewrite exactly those paths anyway, and multi-page triples the leak rate                              | User        |
| E2E                 | Filed to the `e2e-backlog`; the dangerous failure mode is caught more cheaply by unit tests                                                                 | User        |

## Biggest Risk

**Three `typeof invoice === 'number'` guards fail silently on an array** — no type error, no runtime
error, invoices simply stop appearing. One of them feeds the unauthenticated client-share page. This
is why Phase 1 is test-first with the tests proven red, and why the phase's manual checks walk all
three read surfaces.

Second: there is **no `hasMany` precedent in this repo**, so the join table's shape is inferred from
Payload's own internal table. Boot the app against the migrated DB before building anything on top of
Phase 1 — `payload migrate` printing `Done.` proves only that the DDL ran.

## Phases

1. **Data model and read path** — field, migration + backfill, the three guards, the row DTO
2. **Rendering and export** — preview pager, page-count badge, both tables, ZIP, CSV/print
3. **Editing a saved invoice** — add a page, remove one, remove all, from table and edit form
4. **Add form** — multi-file custody, second scan button, two drop zones, nested wire contract
5. **Multi-page AI scan** — API route, multi-image call, prompt sentence, scaled timeout
6. **Blob cleanup and docs** — three leak paths, the backup runbook, the E2E backlog issue

## What We're Not Doing

No page cap. No change to the existing one-photo-one-expense flow. No `invoiceNote` change. No depth
bump on reads. No E2E in this change. No sweep of pre-existing orphaned Blob files.

## Open Risks

- The media whole-table cache (`src/lib/queries/media.ts:20-25`) is sized against a ~2MB ceiling at
  ~988 rows; 2–3× media growth per expense brings that ceiling closer. Not blocking, worth watching.
- `context/changes/blob-backup/runbook.md` keys disaster recovery on `transactions.invoice_id` and
  asserts a 1:1 media↔transaction mapping. Both become false — Phase 6 must land before anyone needs
  that runbook.
- **Preview only — production is not migrated in this change.** The migration is applied to the preview
  DB (`pnpm db:migrate:preview`) before the preview deploy builds, and `main` must not receive this
  code while production still carries the scalar `invoice_id` column.
