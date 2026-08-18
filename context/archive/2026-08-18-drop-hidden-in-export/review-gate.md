# Review-gate ledger — drop-hidden-in-export · 2026-08-18

Scope: the `hiddenInExport` deletion only — 41 files (`src/**` + `context/foundation/roadmap.md`)
plus the new change folder. A parallel session owns
`context/changes/2026-08-18-marza-prognoza-rzeczywista/**` and
`context/changes/2026-08-17-investor-rename-code/**`; those are **out of scope and must not be
touched** by any mutating step.

Checks that dropped out at Step 0: `/10x-impl-review` (no `plan.md` — the change was implemented
without one, which is the process gap that motivated this gate), `tailwind-v4-audit` (no UI/CSS in
the diff), `feature-first-structure` / `module-cohesion-audit` / `structure-scatter-audit` (the diff
adds one file, a migration, into the established `src/migrations/` home; everything else is
deletion). Step 0.5 verification pass skipped: no browser-level surface, and E2E is never run
unprompted in this project.

## Findings

_Trimmed at archive (2026-08-18): the six **fixed** findings are gone — a fix's durable
record is its commit, so restating it here only competes with the code. What survives is the
negative space git cannot hold: what was judged benign, and what was left undone on purpose.
Pre-trim tally: 6 fixed, 3 dismissed, 2 dropped · 0 open._

- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/kosztorys/append-preset-sections.ts:57` ·
      spreading a stored preset's items lets an old payload's `hiddenInExport` key re-enter typed
      state. Verified benign: `diffRow` compares only `ITEM_FIELDS` (the key is no longer a member),
      and `stageIdFromQtyKey` returns null for it so the stage-quantity walk skips it. The key rides
      along inert and never reaches SQL — which is exactly the tolerance `change.md` documents.
- [x] 🔵 OBSERVATION · dropped · `code-review` · — · no regression guard for the "old jsonb payloads
      still restore" claim. Dropped, not filed: kosztorys data is throwaway until dogfooding lands on
      `main` (AGENTS.md), so there are no old payloads in the wild to protect, and a spec pinning the
      mapper's tolerance would assert an implementation property rather than a behaviour anyone owns.
- [x] dismissed · `comment-noise` · `src/migrations/20260818_0_...ts:3` · the "Hand-written
      (migrate:create's snapshot baseline is stale)" line reads as boilerplate but ~20 migrations
      carry it; it is the repo's idiom for why this file isn't generated. Kept.
- [x] dismissed · `comment-noise` · `src/migrations/20260818_0_...ts:9` · the "No backfill / no index
      / no `_v` twin" block looks like narration but is the completeness proof for a destructive
      migration — it records what was checked, matching the `cost_variant` precedent. Kept.
- [x] dropped · `comment-noise` · `context/changes/.../change.md:20` · the carrier inventory
      paragraph restates the diff. Real, but stating what was deleted is a change doc's job and it
      is one paragraph — not worth the churn.
      Clean categories, no findings: INSERT column/value alignment (15 columns = 15 values, correctly
      paired after the removal), SQL select list vs row mapper, migration correctness + registration
      ordering, leftover references, orphaned code, persistence tolerance.

## Simplify pass

Ran `/simplify` — 0 applied, 0 proposed, 0 dismissed; nothing folded into `## Findings`.

Run in the main thread rather than as a 4-agent fan-out: outside the new migration the diff adds
exactly **three** lines (the `note` select-list tail, the re-packed INSERT values tuple, the fixed
comment), all rewrites of lines the deletion displaced. A parallel review fleet over a pure-deletion
diff is the disproportionate ceremony this project's rules forbid. The four angles on that diff:

- **reuse** — no new code to re-implement anything; the migration deliberately mirrors the
  `20260728_0_drop_kosztorys_cost_variant` precedent, which _is_ the reuse.
- **simplification** — the deletion is itself the simplification. `ITEM_FIELDS` /
  `ITEM_INSERT_COLUMNS` keep their positional-parallel shape, one entry shorter.
- **efficiency** — one fewer column read, mapped and written per item row; nothing added.
- **altitude** — fixed at the deepest available level (the column is gone) rather than layered as a
  guard, filter or ignore-rule over a column that would have stayed.

## Tests & suite

No new tests owed. Every finding this gate closed was a comment or a doc line; the one carrying a
test disposition (the deploy-order inversion) is a sequencing hazard with no runtime surface to
assert — its guard is the written order in `change.md` and the migration comment.

- `pnpm typecheck` — clean, re-run after the gate's fixes.
- `pnpm test` 2445 passed / 130 skipped, `pnpm test:integration` 36 files / 127 passed, migration
  applied to the local dev DB and to `db-test` — all green at implementation time. Not re-run: the
  only mutations since are comments and markdown, so a second full pass would prove nothing.
- `pnpm test:e2e` — not run (never run unprompted in this project). No browser surface in the diff.
- `pnpm lint` — 2 errors, both pre-existing in files this change never touched
  (`src/hooks/use-latest-request.ts:15`, `test.js:175`).

## Archive gate

**Open.** Every finding is at a terminal resting place — 0 open boxes. The prod migration is a
deploy-time obligation and does **not** block the slice; per the corrected rule it is owed _after_
the code ships.
