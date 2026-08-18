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

- [x] 🟡 WARNING · fixed · `code-review` · `context/changes/.../change.md:72` · deploy order was
      stated backwards — a DROP inverts AGENTS.md's "migrate prod before pushing", because it is the
      OLD code that needs the column. Migrating first opens a window where the live deploy's
      `selectKosztorysTreeData` selects a dropped column → 42703 on every kosztorys tree read and
      every `insertItems`. Corrected in `change.md`, and the operational half restated in the
      migration's own comment where whoever runs it will actually meet it.
      test: no automated test · — a deploy-sequencing hazard has no runtime surface to assert; the
      guard is the written order in the two places a human reads before running `db:migrate:prod`.
- [x] 🟡 WARNING · fixed · `code-review` · `context/reference/kosztorys-editor-domain-notes.md:237` ·
      the live „co zapisujemy" input inventory still listed `hidden_in_export` — a reference doc
      made factually wrong by the diff, and this one is the _current-truth_ section, not an
      archived block. Removed from the inventory.
- [x] 🔵 OBSERVATION · fixed · `code-review` · `context/reference/kosztorys-editor-domain-notes.md:260,269` ·
      two more stale mentions, inside the already-obsolete CIĘTE block. Fixed anyway rather than
      dropped: `:260` said the flag "has no reader today — EX-549", which after this change reads as
      live pending work. Rewritten as a tombstone naming the drop and EX-695 as the real successor.
- [x] 🔵 OBSERVATION · fixed · `code-review` + `comment-noise` · `src/lib/kosztorys/sheet-import/build-import-plan.ts:233` ·
      comment orphaned by my own deletion — "The sheet has no column for either" was a pair pronoun
      for `note` + `hiddenInExport`, and one referent is gone. Both agents found it independently.
      `for either` → `for it`.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/lib/kosztorys/append-preset-sections.ts:57` ·
      spreading a stored preset's items lets an old payload's `hiddenInExport` key re-enter typed
      state. Verified benign: `diffRow` compares only `ITEM_FIELDS` (the key is no longer a member),
      and `stageIdFromQtyKey` returns null for it so the stage-quantity walk skips it. The key rides
      along inert and never reaches SQL — which is exactly the tolerance `change.md` documents.
- [x] 🔵 OBSERVATION · dropped · `code-review` · — · no regression guard for the "old jsonb payloads
      still restore" claim. Dropped, not filed: kosztorys data is throwaway until dogfooding lands on
      `main` (AGENTS.md), so there are no old payloads in the wild to protect, and a spec pinning the
      mapper's tolerance would assert an implementation property rather than a behaviour anyone owns.
- [x] trimmed · `comment-noise` · `src/migrations/20260818_0_...ts:7` · the "editable in the Payload
      panel … same trap as cost_variant" sentence was post-hoc rationale duplicating `change.md:35`.
      One fact, one home: rationale stays in `change.md`, the migration comment now carries the
      deploy-order warning instead — operational, and belongs next to the SQL.
- [x] dismissed · `comment-noise` · `src/migrations/20260818_0_...ts:3` · the "Hand-written
      (migrate:create's snapshot baseline is stale)" line reads as boilerplate but ~20 migrations
      carry it; it is the repo's idiom for why this file isn't generated. Kept.
- [x] dismissed · `comment-noise` · `src/migrations/20260818_0_...ts:9` · the "No backfill / no index
      / no `_v` twin" block looks like narration but is the completeness proof for a destructive
      migration — it records what was checked, matching the `cost_variant` precedent. Kept.
- [x] dropped · `comment-noise` · `context/changes/.../change.md:20` · the carrier inventory
      paragraph restates the diff. Real, but stating what was deleted is a change doc's job and it
      is one paragraph — not worth the churn.
- [x] fixed · `code-review` · `AGENTS.md:138` · the deploy-order rule stated only the additive case,
      so the same inverted-hazard trap was unmarked for the next destructive migration (the
      `20260728_0_drop_kosztorys_cost_variant` precedent shipped with it unstated too). Rewritten via
      `agent-rule-authoring` as one sentence keyed on the migration's direction — the existing rule
      became its additive branch, rather than a new paragraph.

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
