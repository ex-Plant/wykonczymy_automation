# Review-gate ledger — multi-page-invoices (EX-659) · 2026-08-10

Diff under review: `8d82c0d9..HEAD` (commits `256bb423`, `e86859ea`, `abfc6c0d`, `4cd98d0c`,
`e71abbcb`, `a2aaa7bc`, `0b46428b`) plus the uncommitted review fixes.

## Findings

<!-- One checkbox per finding, most-severe first. Severity tags are the bug-finding checks' own
     (impl-review / code-review); the structural + comment audits carry none. -->

**Trimmed at archive (2026-08-11).** Pre-trim tally: 25 fixed, 4 dismissed, 2 dropped, 1 skipped ·
0 open. The 25 `fixed` findings were dropped here: each one's durable record is the commit that
landed it, readable from the code itself. What survives is the negative space git cannot hold — the
findings we decided _not_ to act on, and why.

- [x] 🟡 WARNING · dismissed · impl-review F6 · `src/lib/actions/transfers.ts:325,338,349` · the three
      invoice actions go through `protectedAction` only, so any management session can attach or
      detach the invoice of any transfer. **Not a defect — the owner ruled this is the desired
      behaviour** (2026-08-10) and it predates this slice. I had wired `fetchAndAuthorize` into all
      three; that was an unplanned access-control change smuggled into a data-model slice, and it
      was reverted. `setTransferInvoices` now carries a comment saying the omission is deliberate,
      so the next reviewer doesn't re-file it.
- [x] 🟡 WARNING · dismissed · code-review · `extract-receipt/route.ts:23` · „the route does not
      escape the body cap it was created for" rests on Vercel functions capping request bodies at
      4.5 MB. That limit was raised to 100 MB; the route-handler path genuinely does escape
      `next.config.ts`'s server-action `bodySizeLimit: '4.5mb'`, which is the whole reason the scan
      is a route. The resource-bound half of the concern (unbounded pages buffered in RAM and billed
      to one model call) is real and is closed by `MAX_RECEIPT_PAGES` above.
- [x] 🔵 OBSERVATION · skipped · impl-review F10.1 · `context/changes/2026-08-10-cron-lead-reconcile/*` ·
      commit `e71abbcb` swept 405 lines of another change's docs into an EX-659 commit — a
      stage-by-explicit-path failure. Not fixed: the only clean removal is rewriting published branch
      history, which is a bigger and riskier operation than the mistake, and the files are inert
      prose that belongs in the repo either way. Flagged to the user instead.
- [x] dropped · module-cohesion · `src/lib/utils/upload-file-client.ts:35-83` · `positionalFiles` /
      `filesByRowId` / `resolveInvoiceMediaIds` are the expense form's wire contract rather than
      upload transport. Real, but the split would move three functions and their single spec for no
      behavioural gain, and the module is 90 LOC — not worth the churn against a slice already
      carrying a bigger extraction (`lib/invoices/`).
- [x] dropped · module-cohesion · `src/lib/export/invoice-zip.ts` · 9 exports across three kinds
      (filename rules, Polish toast copy, row model). Same call: the kinds are all "how an invoice
      archive is named and reported", every export has a consumer, and splitting it would scatter one
      cohesive story across three files.
- [x] dismissed · module-cohesion · `src/components/forms/form-fields/line-items-field.tsx` · 439 LOC
      but one render surface, one reason to change — proportionate growth.
- [x] dismissed · structure-scatter · `src/lib/utils/` junk-drawer trend · this slice followed the
      existing `*-client.ts` precedent; not the slice's fault.

## Simplify pass

Ran `primitive-reuse-scan` over the branch diff — 7 confirmed dupes, all 7 fixed; folded into
`## Findings` above tagged `reuse-scan`. No open or proposed items. Homes catalogued:
`src/components/ui`, `src/hooks`, `src/lib/**`, `src/types` (read from the repo's existing
`.reuse-scan.json`).

## Tests & suite

- Whole-tree gate before the review: `tsc --noEmit` clean · `pnpm lint` 0 errors (80 pre-existing
  warnings) · `vitest run` 1976 passed / 86 skipped · `pnpm test:integration` 83 passed ·
  `pnpm build` succeeded.
- Whole-tree gate after the review fixes + reuse scan: `tsc --noEmit` clean · `pnpm lint` 0 errors
  (82 pre-existing warnings, none in the slice's files) · `vitest run` 1988 passed / 86 skipped ·
  `pnpm test:integration` 83 passed · `pnpm build` succeeded.
- `pnpm test:integration` first failed on its **re-import** leg, not on a spec: `db:import:test`
  restored the dump onto a already-migrated test DB, and the dump's `DROP TABLE`s can't drop
  `transactions` / `media` while the migration's new `transactions_rels` references them — so the
  restore half-applied and the migration then re-ran against a broken schema. Any future migration
  adding a table with FKs into dumped tables would hit the same wall, so `db:import:test` now
  resets the schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) before restoring. Test DB
  only — `db:import` (dev, 5433) is untouched.
