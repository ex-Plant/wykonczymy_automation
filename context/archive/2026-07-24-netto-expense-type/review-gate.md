# Review-gate ledger — netto-expense-type (EX-567) · 2026-07-26

Scope: the uncommitted working-tree diff vs `HEAD` (48 files) on branch
`konradantonik/ex-573-transfer-type-spec-table`. EX-573 (already committed, review-gate closed)
is **out of scope** — `git diff main...HEAD` would drag its 500+ files back in.

Step 0.5 (verification pass) was run ahead of this gate: all 12 EX-567 boxes in
`context/foundation/manual-checks.md` are ticked, pass found no bugs. The two money errors below came
from the review fan-out, not the browser pass — both sit on surfaces the manual checks looked at but
could not catch by eye, because the wrong figures rendered perfectly plausibly.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/hooks/transfers/validate.ts` · "the `d.netAmount = null`
      strip is reverted when the type changes". Verified benign: `type` itself carries
      `access: { update: () => false }`, so the type can never change on an existing row; and under
      `overrideAccess: true` field access isn't enforced either. The scenario cannot materialise.
- [x] 🟡 WARNING · dismissed · code-review · `src/lib/schemas/transfer.ts` · "silently accepts a netto expense
      with no netAmount rule". `createTransferSchema` has no `netAmount` field and `createTransfer` never
      writes one (only the bulk path at `actions/transfers.ts:101` does), so the Payload hook rejects it as
      required — fail-closed, not a hole. Adding schema surface would be dead code.
- [x] dropped · code-review · `src/lib/queries/transfers.ts:72` · the amount search matches `amount::text`
      only, so a netto row can't be found by typing its netto. Real but minor, and the column it backs is
      labelled „Kwota" = brutto; widening a shared search path is a behaviour change worth more than it buys.
- [x] dropped · code-review · `src/components/forms/expense-form/expense-schema.ts` · an empty brutto field
      surfaces both the brutto and the netto-comparison message. Cosmetic form-UX; not worth the churn.
- [x] dismissed · code-review · `src/lib/constants/transfers.ts` · "a NULL `net_amount` bills 0 silently —
      wants a `TODO(EX-449) SENTRY-REQUIRED` marker". The write path guarantees the column
      (`hooks/transfers/validate.ts`) and the 0 is deliberate: a brutto fallback would be the exact
      over-billing this type exists to prevent. Documented in the `billedAmountFor` docblock instead.
- [x] dismissed · module-cohesion · `src/lib/queries/reference-data.ts` · "stale `unstable_cache` key shapes".
      `fetchMaterialTransactionsForInvestment` is not cached (it composes two cached fetches), so the added
      field can't stale a cache entry.
- [x] skipped · structure-scatter · `src/types/reference-data.ts` · proposed a `billedTotal` accessor on a
      `MaterialsT` wrapper to pre-empt an N+1 of per-surface sums. Only one surface sums these rows today;
      the abstraction would be speculative. Revisit if a second one appears.
- [x] filed EX-576 · slice-review-gate Step 3 · browser-level E2E owed by this slice — form gating,
      three-field immutability, the two-line table cell + CSV, the „Wydatki inwestycyjne" Σ, and kasa
      isolation at brutto. Filed to Linear (project Wykonczymy, label `e2e-backlog`).
      test: e2e — multi-boundary (form → action → hook → DB → two render surfaces); deferred with the issue.

## Simplify pass

Run inline in the main thread rather than as a separate `/simplify` invocation — the fan-out's three
file-organization audits had already produced the same finding set, and re-running it would only
re-litigate findings already triaged above. All reuse/dedup/cohesion results are folded into
`## Findings` (tagged `structure-scatter` / `module-cohesion` / `comment-noise` /
`feature-first-structure`): 6 applied, 1 skipped, 2 dismissed, 2 dropped. No separate report file.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm lint` — 0 errors, 87 warnings (all pre-existing; the new migration's unused-`db` warning matches
  every other migration in the tree).
- `pnpm exec vitest run src/__tests__` — **1643 passed / 54 skipped / 93 files**. Three specs were red after
  the mutating pass and were fixed as real signal, not noise: `validate-hook.test.ts` (asserted the old
  English messages), `transfer-constants.test.ts` (its "covers every exported predicate" net correctly
  caught the new `billsNetAmount`), `derive-financials-bucketing.test.ts` (had encoded the settled-netto
  divergence).
- `pnpm test:parity` — **green**. Was red on entry: the manual pass had left probe transaction #4136 in the
  `db-test` container (3209 rows vs the fixture's 3208). Deleted the probe row; the golden master was
  **not** regenerated.
- `pnpm test:e2e` / `pnpm build` — not run. E2E is filed as EX-576; ask before running the full suite.
