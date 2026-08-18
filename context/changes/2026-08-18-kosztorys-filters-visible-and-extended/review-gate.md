# Review-gate ledger — 2026-08-18-kosztorys-filters-visible-and-extended · 2026-08-18

Base: `acf21753^` · branch `kosztorys-filters-visible-and-extended` · 5 commits.
Step 0.5 (verification pass) skipped — it drives the browser, which is not run unprompted.
Manual checks in `context/foundation/manual-checks.md` remain a pending archive blocker.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all seven applied.

## Findings

<!-- [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔴 CRITICAL · fixed · code-review · `src/lib/kosztorys/section-band-rows.ts:isFoldSuppressed` ·
      the client's stored hider (`hideEmptyRows`, which defaults **on**) counted as a narrowing
      gesture, so every shared kosztorys arrived with its folds stood down — the owner could not send
      a folded offer at all. Narrowed the suppression to `kind === 'filter'` hiders plus search.
      test: test-driven-debugging · unit — the existing case „stands them down for the client's own
      hider" had pinned the bug; rewritten to assert the folds survive, red→green.
- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` ·
      the section band's chevron and `aria-expanded` read the STORED fold set while the grid rendered
      the suppressed one — a dead chevron reporting a fold that was not in effect. All reporting
      surfaces now read `effectiveCollapsedSectionIds`.
      test: no automated test · — the seam is a hook return threaded into a grid context; the
      underlying rule is covered at `isFoldSuppressed`, and the render wiring is a manual check.
- [x] 🟡 WARNING · fixed · code-review · `src/components/ui/search-filter-input.tsx:34` ·
      an external write (chip X → `setSearch('')`) did not cancel the pending debounce, so the stale
      timer fired straight after and put the phrase back. The sync effect now clears the timer first.
      test: no automated test · — timer/effect race in a leaf presentational input; the observable
      behaviour is one manual-check box on the chip bar.
- [x] 🟡 WARNING · fixed · impl-review ·
      `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx` ·
      „Wyczyść filtry" was disabled while only a search phrase was set, though the reset clears it —
      the predicate now includes `search.trim()`.
      test: no automated test · — trivial disabled-state predicate; covered by the chip-bar manual box
      that already asserts „Wyczyść wszystko" clears the phrase.
- [x] 🔵 OBSERVATION · fixed · impl-review ·
      `src/components/kosztorys/editor/toolbar/kosztorys-view-menu.tsx:110` · the „Kolumny (n)"
      counter counted a column that an engaged problem forces on screen — the number has to answer
      „czego nie widzę", not „co odznaczyłem". Now excludes `revealedColumnIds`.
      test: no automated test · — one `filter` predicate over an already-tested column set; added as a
      manual-check box instead.
- [x] fixed · structure-scatter · `src/components/ui/filter-chip.tsx` → `src/components/filters/` ·
      the shared filter home was created four days earlier and this was the first primitive added
      since; landing it in `ui/` would have made the scatter permanent. `git mv` + import updated.
- [x] fixed · module-cohesion · `src/components/kosztorys/editor/toolbar/active-filters-model.ts` ·
      the bar rendered `Usuń: {label}`, producing „Usuń: Ukryto: pozycje …". `removeLabel` is now a
      field on `ActiveFilterChipT`, built from the bare name at each of the four chip sites.
- [x] fixed · module-cohesion · `src/lib/kosztorys/row-conditions.ts:liftsToSections` · the rule for
      which conditions lift to sekcje was written twice — as a local type guard in the filters menu
      and inline in the editor hook's `foldableSectionIds`. Moved into the registry; both now read it.
- [x] fixed · comment-noise · `src/lib/kosztorys/row-conditions.ts` · dead export `conditionPlane`
      and its doc block deleted (its two remaining uses were in a spec, converted to `engagedPlane`).
- [x] fixed · comment-noise · 6 sites across the diff · vanished-state tails („used to be", „no
      longer"), a restating paragraph on `FilterChip`, and a false „Sized off the `badge` scale"
      lineage on the same docstring — replaced with the accurate note that it deliberately is not
      built on `BADGE_BASE`.
- [x] dismissed · code-review · `src/components/kosztorys/editor/toolbar/active-filters-model.ts:69` ·
      the `PROBLEM_CONDITIONS` loop can push more than one chip although at most one is ever engaged.
      Benign and deliberate — written as a loop so the bar does not silently drop a second one if the
      exclusivity ever changes; the comment already says so.
- [x] dropped · comment-noise · `src/__tests__/lib/kosztorys/row-conditions.test.ts` · the shared
      `subjects` array makes each case's precondition invisible at the assertion. Real, but the fix is
      a fixture rewrite across 51 cases for no behavioural gain.
- [x] skipped · impl-review · `src/lib/kosztorys/row-conditions.ts:258-374` · the four rate-source
      conditions carry no `revealsColumns`, so narrowing by „stawka wykonawcy" can hide the column
      that decides it. Real, but which columns each should reveal is a design call for the owner,
      not a mechanical fix — behaviour-changing and uncertain.
- [x] skipped · efficiency · `src/components/kosztorys/editor/use-kosztorys-editor.ts` ·
      `conditionCounts` runs one whole-dataset pass per registry entry on every edit; six new entries
      widen it. A review-worthy refactor (single fused pass) on the hottest path EX-496 was reverted
      over — not something to land inside a review gate.
- [x] skipped · module-cohesion · `src/lib/kosztorys/row-conditions.ts` · the file is both the
      registry (the data) and its query layer (`applyRowConditions`, `countMatching`,
      `sectionIdsWhereAllMatch`, …). A defensible split, but it is its own review-sized change.
- [x] skipped · module-cohesion · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` ·
      god module. Pre-existing and far wider than this diff; EX-521 owns the editor-split arc.
- [x] skipped · feature-first · `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts` ·
      `guideX` (a drag-guide pixel offset) sits in the view-state hook among reading state. Real
      smell, pre-existing, out of this slice's scope.

- [x] filed EX-715 · deferred · code-review · browser-level coverage for the chip bar, the search
      debounce race and the client-share fold path — the slice's E2E obligation, filed to the
      `e2e-backlog` in project "Wykonczymy" rather than authored here (a run is ~1h and is never
      started unprompted).
      test: e2e — the four risks and the fixture requirements are written into the issue.

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude) over `acf21753^..HEAD`
plus the working tree — 5 applied, 0 proposed, 4 skipped as review-sized or pre-existing. Every
finding is folded into `## Findings` above, tagged `simplify` / the audit that raised it; there is no
second list. No separate report file was written — this ledger is the report.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm lint` — 2 errors, both outside this diff: `src/hooks/use-latest-request.ts:15` (file untouched
  by the slice) and `test.js:255` (untracked scratch file, no git history).
- `pnpm test` — `2 failed | 2468 passed | 134 skipped (2604)`. Both failures are the known
  `LABOR_COST` / `RABAT` pair from the transfer dialog (`src/__tests__/transfer-rabat.test.ts`,
  `src/__tests__/components/forms/expense-form/draft-type-coercion.test.ts`). **Verified pre-existing:**
  reproduced with the working tree stashed, and `git diff --name-only acf21753^..HEAD` touches no
  expense-form or transfer path.
- `pnpm test:e2e` — not run (never started unprompted; the slice's browser coverage is filed as EX-715).
- `pnpm build` — not run; `typecheck` + `lint` cover the same tree and the slice adds no build-time surface.
