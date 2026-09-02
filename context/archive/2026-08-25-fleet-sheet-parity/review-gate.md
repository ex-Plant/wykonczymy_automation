# Review-gate ledger — fleet-sheet-parity · 2026-08-26

Range under review: `c487c4dc^..713fd350` (5 commits, 45 files).
Checks that survived detection: `10x-impl-review`, `code-review`, `tailwind-v4-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit`.
Step 0.5 skipped — this repo has no `verify-manual-checks` skill; its manual pass lives in
`context/foundation/manual-checks.md` and is the archive blocker instead.

## Findings

- [ ] skipped · impl-review · `src/components/fleet/vehicle-flags.tsx` · a type the vehicle is
      „bezterminowo" exempt from can still be ticked „do wymiany", so the card can show a reminder for
      work that is never due — surfaced, not auto-applied: filtering the list changes what a user MAY
      DO, and that is the owner's call, not a review's. Box stays open until that call is made.
      `test: no automated test — the behaviour to guard doesn't exist yet`
- [ ] skipped · impl-review · `src/scripts/import-fleet-sheet.ts` · the sheet's one unsplit string
      „Przyczepa Knaus" is imported as `make: 'Knaus'` / `model: 'Przyczepa'` — a guess, and the prod
      import writes it for real. Needs the owner's confirmation before the human runs the script.
      `test: no automated test — a data-mapping judgement, not a rule`

- [x] 🟡 WARNING · dropped · code-review · `src/scripts/import-fleet-sheet.ts` · the update payload
      used `?? null` on every optional field, making a re-run destructive: the sheet has no VIN for the
      przyczepa and no uwagi for most cars, so a second run would erase whatever a human typed since
      the first — and `exemptions: []` would re-arm a reminder somebody deliberately silenced. **The
      fix was never written.** The only run that happened was insert-only, and the file was deleted in
      `0fa9dd8e` — so the bug had exactly one chance to bite and did not. Nothing left to fix.
      `test: no automated test · — the file is gone`
- [x] dismissed · comment-noise · `src/collections/vehicle-inspections.ts:—`,
      `src/migrations/20260825_1_fleet_sheet_parity.ts:—` · flagged as „reversal narration". Kept: both
      carry the load-bearing reason `cost` is nullable and point at the decision they partially undo —
      delete them and the code loses the why, which is the strip test's own exemption.
- [x] dismissed · tailwind-v4-audit · — · no findings; the slice added no arbitrary values, no
      `var(--x)` in brackets, and no upstream-scale breakpoints.
- [x] dismissed · suite · `test.js:284` · the repo's sole lint error (`'console' is not defined`).
      Untracked file at the repo root with no git history — not from this slice and not mine to touch.
- [x] dropped · structure-scatter · repo-wide · the `'—'` string literal appears at 25+ sites across
      several features. Consolidating only the fleet ones would create a third pattern rather than
      remove one; took the two that have a real home (`formatKmOrDash`, the `InfoList` fallback) and
      left the rest. Not worth filing.
- [x] 🔵 OBSERVATION · dismissed · impl-review (2. przelot) · `src/components/tables/fleet.tsx:72`,
      `src/lib/utils/format-distance.ts` · both credited to this gate, both actually landed in later
      commits (`d0c81b13`, `202fe790`) — `formatKmOrDash` was lost from the uncommitted tree first and
      broke a clean `staging` build until `202fe790` put it back. The code is correct in HEAD; what
      this exposes is that the `## Tests & suite` gate below ran against a tree that was never fully
      committed. Read it as evidence about that tree, not about any commit.
- [x] dismissed · code-review (2. przelot) · `src/components/nav/nav-openrouter-balance.tsx`,
      `src/components/dialogs/invoice-preview-*.tsx` · scope creep from a parallel session, not fleet
      work. Verified harmless: `isImage` defaults to `false` so every existing trigger is unchanged,
      and the saldo chip renders as before.
- [x] dismissed · code-review (2. przelot) · `src/migrations/20260825_1_fleet_sheet_parity.ts` · the
      migration is already applied locally (batch 33) and `up()` is byte-identical to what ran, so
      editing `down()` creates no drift.

- [x] filed EX-739 · structure-scatter · `src/lib/fleet/types.ts` + `src/types/fleet.ts` · fleet types
      live in two homes and neither is unambiguously local, so every new field is a guess about which
      file it joins. Real, but the fix is either a merge or a one-line rule in `AGENTS.md` — a decision
      of its own, not a fix to slip into this slice.

## Simplify pass

Ran `/simplify` — every fix-now finding above landed through it (no separate report: its results are
the `fixed` lines in `## Findings`, tagged by the check that raised them). 0 proposed, 0 held back.
An addendum `primitive-reuse-scan` over the same diff surfaced the `formatKmOrDash` / `InfoList`
duplication, which is folded in above.

## Tests & suite

Regression guards authored after `/simplify`, so they lock the post-simplify shape:

- `src/__tests__/lib/fleet/costs.test.ts` — new `describe('sumKnown')` (4 specs: all-unknown → `null`,
  mixed, empty set → true `0`, a typed zero survives) plus `leaves odometer readings out of the cost
surface entirely`. **21 pass.**
- `src/__tests__/lib/fleet/reminder-sweep.test.ts` — `never reports a type the vehicle is exempt from`
  (with a negative control: the same overdue row without the exemption DOES fire, so the spec can't
  pass on a digest that is broken for every car). **9 pass.** An earlier revision of this line also
  named a Monday missing-data spec; no such spec exists and none is owed — `findMissingInspections`
  and that whole digest section were removed on the owner's call (see `change.md`).
- `src/__tests__/lib/actions/vehicle-update.test.ts` — `round-trips the „nie dotyczy" exemptions,
including back to none`, asserting the **persisted row** via `payload.findByID`, both directions.
  **5 pass** against the isolated 5435 `db-test`.

Browser-level obligation discharged by filing, not by authoring: **EX-716 §8** (label `e2e-backlog`)
now carries the five paths this slice added that no unit layer reaches — the exemption toggle seen
from both sides, the two conditional polisa columns, ODOMETER staying out of the cost surface, the
unknown-cost rendering on card and footer, and the pre-release draft restore.

Whole-tree gate (2026-08-26):

- `pnpm typecheck` — clean.
- `pnpm lint` — **1 error, 85 warnings**, all in `test.js`, an untracked scratch file at the repo root
  with no git history. Nothing in this slice's 45 files is flagged. Left alone: not ours to touch.
- `pnpm test` — **202 files / 2864 tests pass**, 49 files / 164 tests skipped (the DB-gated specs,
  which have no DB under the plain runner).
- `pnpm exec payload migrate` + the three fleet DB specs against the isolated 5435 `db-test` — pass.
- `pnpm build` — clean, exit 0.
- `pnpm test:e2e` — **not run** (never run unprompted; ~1h per run).

## Archive status

**Not archivable — in review.** Two blockers stand:

1. Two open `[ ]` boxes above, both awaiting the owner's decision rather than an edit.
2. `context/foundation/manual-checks.md` § `fleet-sheet-parity` — 14 unticked boxes.

The prod migration (`pnpm db:migrate:prod`) and the one-off import run are human-owned and orthogonal
to this gate; the script is deleted after that run.

_Trimmed at archive (2026-09-02): 19 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 19 fixed, 11 other, 0 open._
