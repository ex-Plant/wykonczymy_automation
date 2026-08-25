# Review-gate ledger — 2026-08-19-fleet-manual-flags-and-service-type (EX-711) · 2026-08-24

Scope: 13 commits on `fleet-manual-flags-and-service-type` vs merge-base `7ed0ea4d`, 41 files.
Three commits (`b95c4f9e`, `4a1f8168`, `11b2b1e5` — delete guards for investments / users / cash
registers) belong to no declared change but ship on this branch; reviewed for correctness only and
tagged `poza zmianą`.

Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill in this install. The manual
layer is the registry in `context/foundation/manual-checks.md`, owned by the user.

Fan-out: `10x-impl-review`, `code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all seven applied.

## Findings

> **Trimmed at archive (2026-08-25).** Pre-trim tally: **21 fixed, 2 skipped, 3 dropped, 12 dismissed · 0 open**. The 21 fixed findings were removed — a fix's durable record is its commit and the code it left behind. What survives below is what was deliberately _not_ done, and why.

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

### Correctness

- [x] 🟡 WARNING · dismissed · `impl-review` + `code-review` · `src/lib/fleet/flags.ts:57` · the retirement window `performedOn >= flaggedAt` retires a mark stamped on a day work was already recorded, so ticking reads as a no-op. A day carries no clock, so that ordering and the common one (mark in the morning, work recorded in the afternoon — manual check #2) are the same row; no rule over these two values separates them. I applied the strict-`>` fix and **reverted it** — it breaks the common case instead. Owner ruled 2026-08-24 that „zrobione, ale nadal do wymiany" does not occur in this fleet, so the losing case is not worth a warning either. `>=` stands; the trade-off is recorded in the `activeFlags` comment.
      test: already guarded · unit — `flags.test.ts` „retires a mark answered the same day" pins the chosen reading.
- [x] 🔵 OBSERVATION · skipped · `impl-review` + `code-review` · `src/components/fleet/vehicle-flags.tsx:26` / `src/lib/actions/fleet.ts:75` · concurrent toggles and two managers on one vehicle are last-write-wins; the action's read-modify-write is not transactional. Real, but the surface is one vehicle panel in a small team — the fix is a transaction + serialization for a collision nobody will hit.
      test: skipped with the finding.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/access/index.ts` · removing `isAdminOrOwnerOrSelf` narrows delete so a MANAGER can no longer delete their own user. Verified: zero remaining references, `access-control.test.ts` updated in the same commit. Intentional, and `poza zmianą` — surfaced under the branch-scope finding below rather than reverted.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/collections/users.ts` · guard verified correct — all four queried slugs/fields exist, counts parallelized. (Its comment is wrong about one FK; that is a separate finding below.)
- [x] 🔵 OBSERVATION · dismissed · `code-review` · deploy ordering — the migration is additive, so prod must be migrated before the push or `/flota` 500s on `42703`. Already recorded in the change docs and in AGENTS.md; the human owns `pnpm db:migrate:prod`.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/stores/create-form-store.ts` · no persist `version`/`migrate` bump for the new `formId` key. Owner ruling this session: there are no stale drafts to migrate, sessionStorage is per-tab, and an unstamped entry rehydrates with `formId: null` which matches nothing. The safe behaviour is enough.

### Plan drift

- [x] 🟡 WARNING · dismissed · `impl-review` · `src/app/(frontend)/flota/[id]/page.tsx:71-73` · plan promised `FlagBadge` on both surfaces; the detail page renders `VehicleFlags` instead. The checkbox list is the same information with more affordance — a read-only badge next to the editable box it mirrors would be redundant chrome, not a second surface.
- [x] 🟡 WARNING · skipped · `impl-review` · branch scope · five commits belong to no declared change (three delete guards, an access-control narrowing, a form-store fix). Reviewed for correctness and clean; splitting them out now is a rebase of 13 commits for bookkeeping. Surfaced, the user's call at merge time.

### Structure & reuse

- [x] dropped · `feature-first-structure` vs `module-cohesion-audit` · `src/components/forms/inspection-form/inspection-form.tsx:68-88` · extract the ingest cluster to `use-inspection-files.ts`. The two audits disagree — 17 lines welded to this form's own state, with no second consumer. Not clear-cut enough to churn.
- [x] dismissed · `module-cohesion-audit` · `src/lib/fleet/thresholds.ts` · splitting date buckets from the km interval. Both are „how close counts as due"; the split would trade one cohesive file for two anaemic ones.
- [x] dismissed · `module-cohesion-audit` · `src/lib/queries/fleet.ts:22` · `export type { FleetDatasetT }` flagged as a dead re-export. A spec imports it from here — it is a re-export with one consumer, not dead code.
- [x] dismissed · `module-cohesion-audit` · `src/lib/actions/fleet.ts:18` · `flagsSchema` colocated with the action. One-line schema, one consumer, in the file that consumes it.
- [x] dismissed · `structure-scatter-audit` · no file this slice added landed in a competing home or created a new one. Clean.

### Comments

- [x] dropped · `comment-noise-audit` · `src/components/ui/info-list.tsx:6`, `src/components/tables/fleet.tsx:58`, `src/migrations/20260819_1_…:8` · flagged as padded, kept. `info-list` explains why `stacked` exists, `tables/fleet.tsx:58` is the rationale for the very move the plan-drift finding above records, and the migration paragraph carries the jsonb-over-child-table decision.
- [x] dismissed · `code-review` · `src/migrations/20260819_1_…:11` · flagged for bundling `ALTER TYPE … ADD VALUE 'SERVICE'` with `ADD COLUMN flags jsonb` against the „alone in its migration" convention. The guardrail is not missing — lines 11-12 already state the rule and why this file satisfies it (the value is never USED in the same transaction). Nothing to add.

### Styling

- [x] dismissed · `tailwind-v4-audit` · clean, 0 fixes. `grid-cols-[auto_1fr]` (`info-list.tsx:21`) is grid-template syntax, not an arbitrary value substituting for a token, and predates the branch. Zero breakpoints in the diff.

### Out of branch

- [x] dropped · `impl-review` · `src/hooks/use-latest-request.ts:15` · `pnpm lint` is red here, from before the merge-base. Not this slice's to fix, and too small to file.

## Simplify pass

No separate `/simplify` discovery run: its three lenses (reuse/dedup, module placement, comment noise)
were already the fan-out's `feature-first-structure` + `module-cohesion-audit` +
`structure-scatter-audit` + `comment-noise-audit`, and a second pass over the same 41 files would
re-discover the same list. The mutating step ran directly against the triage above — every `fix now`
finding applied in the main thread, folded into `## Findings` rather than a parallel report.

Net new files from the pass: `src/hooks/prevent-delete.ts` (`makePreventDelete`, replacing the three
hand-rolled `beforeDelete` guards) and `src/components/fleet/alert-badge.tsx` (`AlertBadge`, the one
alarm shape behind `FlagBadge` and `OilIntervalBadge`).

## Tests & suite

- `tsc --noEmit` — clean.
- `vitest` over `lib/fleet`, `lib/actions/vehicle-update`, `collections`, `lib/queries` against
  `db-test` (5435) — 22 files / 157 passed, 5 skipped. One failure, pre-existing and unrelated:
  `preview-kosztorys-token.test.ts` hits `column "hidden_columns" does not exist` because `db-test`
  carries staging's `20260824_0_drop_kosztorys_client_view_hidden_columns` while this branch is 37
  commits behind it. Same three files failed before any change in this gate.
- New regression guard: `vehicle-update.test.ts` → „clears „Rocznik" when the field is emptied",
  asserting the persisted `year` is null. Green.
- Delete-guard specs (`investments`, `users`) re-run after the `makePreventDelete` refactor — green,
  message contract preserved.
- E2E obligation for this slice: filed as **EX-716** (`e2e-backlog`), not authored here.
- Full suite: not re-run in this gate — the last full run this session was 229 files / 2761 tests with
  the same three pre-existing `hidden_columns` failures.
