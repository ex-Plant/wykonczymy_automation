# Review-gate ledger — drop-stage-percent-columns · 2026-08-17

Slice diff: `afeff70c^..HEAD` (3 commits) on branch `client-preview-settings`.
Checks run: `/10x-impl-review`, `/code-review`, `comment-noise-audit`,
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`.
Dropped: `tailwind-v4-audit` (no styling touched), Step 0.5 verification pass
(no `verify-manual-checks` skill installed).

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md:207` · EX-570 check still told a tester to look at the per-etap `%` column — dropped `/ %` from the column list
      test: no automated test · — a registry line, not code; the deleted column is already covered by the new section's box 3
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:72` · claimed Prettier violation — `prettier --check` is clean on every file in the diff (verified after the comment edits)
- [x] 🔵 OBSERVATION · fixed · impl-review + comment-noise · `src/lib/kosztorys/column-config.ts:88`, `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts:32` · both pointed at `constants.ts` for the ghost-id reasoning that lives in `stage-keys.ts` — repointed
- [x] 🔵 OBSERVATION · fixed · impl-review + comment-noise · `src/__tests__/components/kosztorys/editor/grid/kosztorys-layer.test.ts:23` · rewritten comment restated the array below it — deleted
- [x] 🔵 OBSERVATION · fixed · impl-review + comment-noise · `src/lib/kosztorys/column-config.ts:203` · „least-read of them" lost its antecedent when the third stage axis died — now „the less-read of the pair"
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-08-17-drop-stage-percent-columns/plan.md:365-375` · Progress boxes ticked without the sha the plan's own convention requires — appended `afeff70c` / `98b6c03a`
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts:125` · spec restructure went past §10's wording (5 `it`s → 4) — verified strictly better: zero `rowDoneFraction` assertions lost, one gained, all four invariants intact
- [x] fixed · comment-noise · `src/components/kosztorys/editor/use-kosztorys-editor.ts:236` · still named „the progress display" as a live preview gate — trimmed to the layer + picker
- [x] fixed · comment-noise · `src/hooks/use-persisted-enum.ts:6` · still listed „progress display" among the hook's consumers — dropped
- [x] fixed · comment-noise · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:485` · trim-trap leftover restating what „% wykonania" is — deleted, the przedmiar-anchoring rationale below it kept
- [x] fixed · comment-noise · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:563` · third copy of the „Komentarz is the divider" note (already at `:527` and `:551`) — deleted
- [x] fixed · comment-noise · `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx:83` · vanished-state („replacing the toolbar toggles") plus a verbatim duplicate of `:47-48` — deleted
- [x] fixed · structure-scatter + simplify · `src/__tests__/components/kosztorys/editor/grid/kosztorys-money-axis.test.ts:28` · the new `donePercent` assertion read the constant, against this file's stated rendered-ids altitude — replaced by one entry in `NEUTRAL_IDS`, which the existing fail-open test already sweeps across all four axes (stronger, and at the right layer)
- [x] fixed · simplify · `src/lib/kosztorys/calc.ts:166` · `rowDoneFraction` was a public one-liner delegating to a private one-liner with the `> 0` rationale stranded on the callee — collapsed into one function, one doc block
- [x] skipped · simplify · `src/components/kosztorys/editor/toolbar/kosztorys-view-axis-options.tsx:39,60` · with the third axis gone, `MONEY_PAIR_CONFIG` / `LAYER_PAIR_CONFIG` could be derived from `options[0]/[1]` inside `AxisSection` — a real ~14-line win, but it drops a prop and its spec parameterises over both configs; review-worthy refactor, not a gate fix
- [x] dropped · comment-noise · `src/lib/kosztorys/layer.ts:9` „three buckets" vs four `LayerT` states, `column-config.ts:17` stranded „Rozjazd" note · pre-existing, untouched by this slice, not worth the churn
- [x] dropped · code-review · `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx` · missing `DropdownMenuSeparator` before „Warstwy" when the Kwoty section is hidden in subcontractor views — pre-existing and cosmetic
- [x] dropped · structure-scatter · `table-columns:kosztorys-progress-display` localStorage key is now written by nothing · inert orphan, accepted in `plan.md:66,71`; nothing enumerates the `table-columns:` family so it can never resurface

`/code-review` returned **0 findings** — no dangling references repo-wide, `tsc --noEmit` clean,
`sanitizeClientViewSettings` filters stored keys on both the read and the write plane, and the
`keep()` chain lost exactly one AND-term with no permanently-true conjunct left behind.

## Simplify pass

Ran `/simplify` over the slice diff — 2 applied, 1 skipped, 0 dismissed; each folded into
`## Findings` (tagged `simplify`). It also verified the two surviving axis modules
(`money-axis.ts` / `layer.ts`) are correctly left un-merged: they look alike now that the third
instance is gone, but `axisAllows` exempts by an explicit set while `layerAllows` derives the
untagged side as "work" — factoring them would make the parameters the code.

Worktree note: a parallel agent's in-flight work (`divergenceFilterEngaged`, `UNPICKABLE_COLUMNS`,
`row-conditions.ts`, `divergence-column.test.ts`) shares several of these files. Nothing here
touched it, and it must not be staged with this slice.

## Tests & suite

- `pnpm typecheck` — clean
- `pnpm exec vitest run` — 2303 passed, 120 skipped, 0 failed. First run reported 1 failure that did
  not reproduce on rerun (shared-DB spec, unrelated to this slice).
- `pnpm build` — exit 0
- `pnpm lint` — 3 errors, all pre-existing and outside this slice (2 × `no-undef` on `console` in the
  untracked `test.js`, 1 × "Cannot access refs during render" in `src/hooks/use-latest-request.ts`)
- `pnpm test:e2e` — not run (never run unprompted)

No new tests owed: `/code-review` found 0 correctness findings, and every fix in this ledger was a
comment or a structural collapse with existing coverage (`kosztorys-calc.test.ts`,
`kosztorys-money-axis.test.ts` both green after).

## Archive gate

**Blocked — the slice is in review, not Done.** All finding boxes are checked, but the 9 manual
checks in `context/foundation/manual-checks.md#drop-stage-percent-columns` are unticked. Do not
archive and do not move EX-703 to Done until a human works that list.
