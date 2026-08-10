# Review-gate ledger — consolidated branch `46183ca3..HEAD` · 2026-08-10

Unit of work: the consolidated temporary branch, 16 commits / 44 files, spanning
EX-534, EX-635, EX-641, EX-643, EX-645, EX-646, EX-647, EX-648. Reviewed in an isolated
worktree (`.claude/worktrees/slice-review-consolidated`, branch `review/consolidated-gate`)
so the main worktree stays free.

No single `change.md` covers the range, so this ledger was written to the `.review-gate/`
fallback path and moved here at archive time — a branch-scoped gate belongs to no one change
folder. Changes it covers that have since archived:
`context/archive/2026-08-08-generic-pending-store/`,
`context/archive/2026-08-10-kosztorys-tree-fixture-builder/`.

Step 0.5 (browser verification pass) skipped — no `verify-manual-checks` skill installed.
Fan-out: all seven checks applied, none dropped.

**Trimmed at archive.** The 13 `fixed` findings were removed: each one's durable record is its
commit, and a ledger line describing a change is strictly worse evidence than the change. What
survives is the negative space git cannot hold — what a reviewer looked at and chose **not** to
act on, and why. The two fixed findings that filed an E2E obligation are kept in condensed form,
since a filing leaves no commit either.

Final tally before the trim: **13 fixed, 7 dismissed, 5 dropped, 0 open.**

## Findings

- [x] partly fixed, rest accepted · `code-review` · `sheet-setup-dialog.tsx:66`, `stage-header.tsx:172`, `save-preset-dialog.tsx:95`, `line-items-field.tsx:261`, `file-input.tsx:128` · the EX-647 `Description` adoption renders an `Info`/`TriangleAlert` glyph at five sites that previously had none (`withIcon` defaults true; pre-existing no-icon sites pass `withIcon={false}` explicitly — verified). Resolved per site from the layout rather than by eyeball:
      · **fixed** — `line-items-field.tsx:261` gets `withIcon={false}`. It sits in `flex items-start gap-2` holding Kwota (`w-28`) + optional Netto (`w-28`) + Opis (`flex-1`) + optional kategoria (`flex-1`) + a `size-9` delete slot, and the note is `shrink-0 whitespace-nowrap` — so a glyph's ~1rem comes straight off the two `flex-1` inputs on a narrow viewport. `tone="error"` already carries the alarm.
      · **accepted** — the other four. `file-input.tsx:128` is a full-width inline error under a field (`TriangleAlert` is what it wants; `role="alert"` preserved, and `<div>`→`<p>`, both block, changes no layout); the three dialog/menu notes are full-width blocks with room for the glyph. The icon IS the primitive's default, so rendering it is what "adopt `Description`" buys — cheap to reverse per site with `withIcon={false}` if the owner dislikes it.

- [x] fixed, test filed · `code-review`+`impl-review` · `src/components/forms/expense-form/use-receipt-generation.ts` · `.finally()` re-throws, so a rejecting scan wedged the form with `isGenerating` stuck true and the rejection escaping unawaited. Fixed with `try/catch/finally`.
      test: test-driven-debugging · e2e — **filed EX-655**. No DOM/hook harness in the repo (no `jsdom`, no `@testing-library/react`), so `isGenerating` is unreachable from a Vitest spec; the behaviour is browser-level anyway.
- [x] fixed, test filed · `code-review` · `src/components/kosztorys/editor/use-kosztorys-editor.ts` `saveSetting` · all four „Opcje rozliczenia" writes shared one module-level pending key, so a second write's `finally` cleared the first's pill. Fixed by keying per setting.
      test: TDD · e2e — **filed EX-656**. The store-level guarantee is covered by `pending-store.test.ts`; what's unasserted is the editor passing distinct keys, which needs the editor rendered.

- [x] dismissed · `code-review`+`module-cohesion`+`impl-review` · `use-kosztorys-editor.ts:155,207,215` · three `eslint-disable react-hooks/refs` directives dropped inside the pending-store commit with no explanation. Independently verified benign by two agents — `eslint-plugin-react-hooks@7.0.1` reports zero problems on the file; the directives were stale. Blank-line residue folded into the comment-noise fix.
- [x] dismissed · `module-cohesion` · `use-kosztorys-editor.ts` (1349 LOC) · god module by size, real seams — but pre-existing and already tracked as consciously-deferred debt under EX-515 ("cohesive stateful unit, needs a test harness first"). The branch's net effect on the file is a shrink. Re-filing would manufacture duplicate backlog.
- [x] dismissed · `impl-review` · `src/stores/pending-store.ts:28-30` · `firstPendingLabel` exported from the store rather than living in the indicator's selector, contra the plan. The export is what the spec asserts against — better than planned, not drift.
- [x] dismissed · `impl-review` · `serialize-apply-preset.test.ts:226-302` · four standalone `payload.create` calls migrated beyond the plan's stated "each `beforeAll`" scope. Rows verified identical field-by-field; scope creep in the consistent direction.
- [x] dismissed · `code-review` · `pending-store.ts:28-30` + `pending-submit-indicator.tsx:14-18` · oldest-label-wins means a scan in flight keeps the pill while a later optimistic save goes unacknowledged. Both are genuinely in flight and the label is not a lie — deliberate design, benign.
- [x] dismissed · `comment-noise` · `restore-deleted-worker.test.ts:12` · near-verbatim copy of `insert-kosztorys-tree.ts:23`, but it ends on a different why (justifying the _test layer_: a mocked insert would accept the dangling id). Earns its bytes.
- [x] dismissed · `tailwind-v4-audit` · whole diff · zero findings — no arbitrary values, no `var(--token)` in brackets, no inline styles, no responsive variants touched. The diff moved _toward_ the v4 target state.

- [x] dropped · `impl-review` · `src/components/ui/pending-submit-indicator.tsx` · `!label` (falsy) vs `label ?? …` (nullish) use different emptiness notions, so `start(key, '')` would never render. No caller does this; guarding it would add a branch for a hypothetical.
- [x] dropped · `impl-review` · `__tests__/helpers/kosztorys-db-tree.ts:92,94` · `wToolsOverrideValue ?? 0` / `ownToolsOverrideValue ?? 0` coerce an explicitly-passed `null` to `0` on nullable columns. No spec passes null there; the other 16 defaults honour the plan's null-survival rule. Latent asymmetry, not a defect.
- [x] dropped · `structure-scatter` · `__tests__/helpers/kosztorys-db-tree.ts` · shared domain noun with the sibling `kosztorys-tree.ts`. The file's own header already disambiguates the two, and `db` is an established marker in this repo (`*.db.test.ts`). A rename would erase a ~1-second hesitation at the cost of real churn — the audit itself dropped it rather than proposing it.
- [x] dropped · `feature-first` · `src/components/forms/hooks/` · holding expense-only hooks is a competing home that predates the branch. Superseded by the fix-now scatter finding, which resolved it properly rather than recording it twice.
- [x] dropped · `reuse-scan` · repo root · the skill asks for a `.reuse-scan.json` primitive-homes map on first run. Not created: a durable repo-config dotfile has no business landing on a throwaway review branch, and AGENTS.md is the canonical home if it is ever wanted.

## Simplify pass

Ran the mutating pass directly in the main thread (the built-in `/simplify` is a user-invoked
command, not agent-callable) plus `primitive-reuse-scan` diff-scoped — 11 applied, 1 dropped,
2 open at the time; each finding folded into `## Findings` above. No separate report.

Reuse-scan catalogue check: `stores/pending-store.ts` reinvented nothing (no existing pending/
submitting flag anywhere in `src/stores`); `lib/utils/is-active-ref.ts` and the two test-tree
helpers were triaged above.

## Tests & suite

- `pnpm typecheck` — **pass** (clean; needed `pnpm generate:importmap` first, since the generated
  import map is gitignored and absent from a fresh worktree).
- `pnpm lint` — **pass**, 0 errors / 80 pre-existing warnings (all `no-unused-vars` in migrations
  and scripts, none in touched files). Touched files also run through `prettier --write`.
- `pnpm exec vitest run src/__tests__/stores/pending-store.test.ts src/__tests__/lib/utils/is-active-ref.test.ts`
  — **11 passed**. Scoped to the non-DB specs covering touched code.
- Full suite (`test` / `test:integration` / `test:e2e` / `build`) — **not run**: the DB-backed legs
  share the 5435 `db-test` container with the parallel session in the main worktree. Still owed
  before the PR merges.

## After the gate

- `154ebe8a` — the dialog path was migrated onto `pending-store`, collapsing the indicator's two
  sources into one. This reverses EX-648's stated non-goal; recorded in
  `context/archive/2026-08-08-generic-pending-store/change.md` and distilled into
  `context/foundation/lessons.md`.
