# Review-gate ledger — kosztorys-filter-conditions (EX-665) · 2026-08-14

Scope: `3980109b..HEAD` (23 files). Verification pass (Step 0.5) skipped — no browser-verification
skill in this install.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `comment-noise-audit`,
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`. All five returned.
`tailwind-v4-audit` came back clean — every scanner hit was pre-existing code outside the range or
canonical v4 syntax in stock shadcn; its one standing item (no Tailwind-aware ESLint plugin in the
repo) is out of diff and dropped.

## Findings

- [x] fixed · structure · `src/components/filters/` · `FilterMultiSelect` + `FilterTriggerButton`
      were shared primitives living in a feature folder — three features and a shared hook imported
      them, so `rm -rf components/transfers` broke kosztorys and cash-registers. Moved to a new
      `components/filters/` tier (not `components/ui/`, which is shadcn-only here — these carry app
      semantics: URL encoding, debounce). `FilterSelect` moved with them: it has one consumer today,
      but leaving it behind recreates the exact scatter this fixes. Six import sites rewritten;
      `tsc` clean, suite green. **Filed instead of fixed was the first plan — Linear refused the
      create (workspace at its free issue limit) — and a `git mv` plus six imports gated on `tsc`
      is not a defer-worthy change, so it was fixed here.**
- [x] 🟡 WARNING · fixed · code-review · `filter-multi-select.tsx:224` · „Zresetuj filtry" read its
      `disabled` off committed state while the menu showed uncommitted local state, so it was inert
      for the whole 600 ms debounce after a section click — clicking Reset then folded the section it
      was meant to undo. The caller's flag now governs only what the caller owns; the option list's
      half is judged on the LOCAL selection.
      test: no automated test · unit — the defect is the debounce/commit seam of a client component
      with no spec harness; the manual check „jest klikalny natychmiast po odptaszkowaniu sekcji"
      carries it.
- [x] 🟡 WARNING · fixed · code-review · `kosztorys-editor-body.tsx:239,250,270` · two `inset-0`
      empty-state overlays could paint on top of each other (empty kosztorys + engaged condition),
      newly reachable because conditions now persist. Both siblings gated on `subtotals.length > 0`.
      test: no automated test · e2e — overlay stacking is a render-order fact, not a logic one.
- [x] 🟡 WARNING · dismissed (code) / fixed (docs) · code-review + impl-review F6 ·
      `section-band-rows.ts:12` · the fold is no longer suppressed by conditions, while the comment
      still claimed „search **or a condition**". The **code is right**: conditions and folds are
      ticked in the same „Filtry" menu, so suppressing the fold would make those checkmarks describe
      nothing, and it would kill the „Sekcje bez wykonanych prac" row outright. Comment corrected in
      `section-band-rows.ts` and `use-kosztorys-editor.ts:451`. **Behavioural call worth the owner's
      eye:** a strict condition can still leave hits sealed under a fold set earlier.
- [x] 🟡 WARNING · fixed · impl-review F5 · `context/foundation/manual-checks.md:958` · the 13 manual
      checks were frozen pre-reversal — four asserted behaviour `c6c32570` reversed (the old
      „Tylko bez przedmiaru" grammar, the trigger count, the surviving empty band). Rewritten to the
      shipped grammar, plus a check for the reset button. `plan.md` gained a „Reversals after live
      testing" header block so its phase contracts can't be read as current truth.
- [x] 🟡 WARNING · dropped · impl-review F1 · `use-engaged-conditions.ts:11` · the persisted
      localStorage map is not versioned, so a key written before the semantic inversion is reread
      under the new meaning. Only reachable on a dev machine that used the pre-`c6c32570` build; the
      renamed ids are no-ops and the survivors are one click to undo. Not worth a migration for two
      browsers.
- [x] 🟡 WARNING · fixed · code-review + impl-review F3 + module-cohesion ·
      `use-kosztorys-editor.ts:458` · `hiddenRowCount` was dead (zero consumers) and cost a second
      full-dataset `filterRows` pass per render; its comment described a toolbar control that does
      not exist. Deleted.
- [x] 🟡 WARNING · dropped · impl-review F4 · `use-kosztorys-editor.ts:359,424` · ~ten full-dataset
      passes per recompute, and `foldableSectionIds` is not preview-gated. Each is a memo over ≤1000
      rows; the profile that would justify restructuring the hook doesn't exist yet, and the hook's
      split is the EX-515-deferred unit.
- [x] 🟡 WARNING · dismissed · impl-review F2 · `kosztorys-filters-menu.tsx:91,103` · the trigger
      count excludes diagnostics while the reset's `disabled` includes them. Deliberate and
      documented: nothing in the menu is ticked for a diagnostic, so counting one produced
      „Filtry (2)" over an untouched list — but reset genuinely clears it.
- [x] 🔵 OBSERVATION · fixed · code-review · `kosztorys-editor-body.tsx:276` · a stale persisted id
      (a condition removed in a later release) passed the `size > 0` gate but survived none of the
      registry lookups, rendering the title `Brak pozycji ` with nothing after it. Gate now counts
      recognised conditions.
      test: no automated test · unit — `applyRowConditions`' own spec already pins that a stale id is
      a no-op; this was the overlay's gate reading raw set size instead.
- [x] 🔵 OBSERVATION · fixed · code-review · `filter-multi-select.tsx:197` · under `triggerCount` the
      badge and the active highlight disagreed (`Filtry (1)` rendered in the inactive style). The
      trigger now highlights on whatever it counts.
- [x] 🔵 OBSERVATION · fixed · code-review · `section-footer-cell.tsx:37` · the `z-10` + spill
      construction survived the move to „Opis prac" while the CSS rule that suppressed the
      neighbouring border was deleted. The footer label now clips inside its own cell — the footer's
      vertical rules are what align its figures with the columns above.
- [x] 🔵 OBSERVATION · skipped · code-review · `filter-multi-select.tsx:249` · in `bulkToggleLabel`
      mode the row's tick means „all hidden", the inverse of every other tick in the menu, and
      clicking it while ticked expands rather than collapses. Real, but the copy and the grammar are
      the owner's call made at the keyboard — surfaced, not silently rewritten.
- [x] 🔵 OBSERVATION · dismissed · impl-review F7 · `use-engaged-conditions.ts` · a diagnostic stays
      engaged while its toolbar button unmounts at count 0. Recoverable — the empty state names it
      and offers the reset — and that is the goal state the design says out loud.
- [x] 🔵 OBSERVATION · dismissed · impl-review F9 + structure-scatter · `ui/command.tsx:52,112` · the
      shared cmdk heading restyle rode this slice and touches transfers + cash-registers menus. The
      owner asked for exactly that („popraw globalnie") rather than a per-menu override.
- [x] fixed · impl-review F8 + comment-noise · `hooks/use-active-conditions.ts` · the
      `active*` → `engaged*` rename skipped the one file where „active" names the opposite state.
      File renamed to `use-engaged-conditions.ts`, `activeIds` → `engagedIds`, comment rewritten to
      say why the word changed.
- [x] fixed · comment-noise · 4 deletions · `section-band-rows.ts:22` (docstring restating the
      function name), `section-footer-cell.tsx:12` (restates the field name), and two in
      `filter-multi-select.tsx` narrating the line below them.
- [x] fixed · comment-noise · 4 trims · `kosztorys-editor-toolbar.tsx:60` said the filters live in
      the „Sekcje" menu (it is „Filtry"); `filter-multi-select.tsx:38` lost a purple restatement;
      two test comments lost their diff-relative tells („now", „the case that motivated this
      change").
- [x] fixed · comment-noise + dead code · `filter-multi-select.tsx:33` · `selectAllLabel` /
      `deselectAllLabel` were overridable props with zero overriders repo-wide — their only caller
      was deleted in this slice. Props removed, the copy inlined as the fixed default.
- [x] fixed · module-cohesion · `use-kosztorys-editor.ts:495` · the destructured `sectionRows`
      shadowed the new hook-scope `sectionRows` in the same 1400-line body. Local renamed.
- [x] skipped · module-cohesion · `use-kosztorys-editor.ts:453` · `ordinalByRowId` and `sectionRows`
      each have one consumer and could live as memos in `kosztorys-editor-body.tsx`. Both derive from
      the hook's internal `rows`, which the body does not hold — moving them means widening a
      different seam. Belongs with the EX-515-deferred split of this hook.
- [x] dropped · feature-first-structure · `row-conditions.ts:123` · `listLabels` is Polish-copy
      grammar with no row-condition knowledge, so by the letter it belongs in `lib/utils/`. One
      consumer, five lines, and it reads better next to the labels it joins.
- [x] dropped · module-cohesion · `filter-multi-select.tsx:59-61` · `togglesHeading` /
      `actionsHeading` / `optionsHeading` could collapse into one `headings` object. Three passthrough
      strings; the object costs the caller more than it saves.
- [x] dismissed · tailwind-v4-audit · whole diff · 0 actionable findings — the only `command.tsx`
      edits are token→token, `globals.css` is deletion-only, no responsive variants added.

- [x] fixed · reuse-scan · `section-band-rows.ts:54` · `buildSectionBandRows` hand-rolled the exact
      body of `groupBySection` (`lib/kosztorys/row-ops.ts:157`) — same Map, same insertion order, same
      push. Replaced with the call.
- [x] dropped · reuse-scan · `use-engaged-conditions.ts:16` · `storesByKey` looks like it belongs in
      `createJsonMapStore`, but this is the only per-investment store — `useHiddenColumns` and
      `useColumnWidths` are module-scope singletons. One instance is not a primitive.
- [x] dropped · reuse-scan · `section-band-rows.ts:23` · `sectionRepresentatives` could read
      `[...groupBySection(rows).values()].map((g) => g[0])`, but it is a different reduction
      (first-wins vs collect-all) and the reuse would allocate every row into arrays to throw them
      away.

## Simplify pass

`/simplify` **not run as a separate pass — deliberately, not skipped.** Its remit (reuse /
simplification / efficiency / altitude on the changed code) is exactly what `/code-review`,
`module-cohesion-audit`, `feature-first-structure` and `comment-noise-audit` had already covered on
this same diff, and every confident fix from those was applied fix-first in the triage above. What
`/simplify` uniquely adds — the primitive-reuse angle — was run explicitly as `primitive-reuse-scan`
(three findings, one fixed). A second general pass would re-report the ledger.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm test` — **2197 passed / 109 skipped**, 145 files.
- `pnpm lint` — **0 errors**, 82 pre-existing warnings (migrations' unused `db`, the untracked
  `test.js` at repo root).
- `pnpm build` — verified green in the main checkout by the impl-review agent before this triage; the
  edits since are TypeScript and CSS-class only, covered by the clean typecheck.
- `pnpm test:e2e` — **not run** (never run unprompted; ~1h).

No new automated test was authored. Every correctness finding here was a render-gate or a
debounce-seam defect in a client component with no spec harness — the disposition is recorded per
finding above, and the two user-visible ones are pinned by new lines in `manual-checks.md`.

## Archive status

**Gate clear — zero open boxes.** Every finding reached a terminal disposition; the last open one
(the `FilterMultiSelect` promotion) was closed by fixing rather than filing, since Linear is at its
free issue limit and the move was mechanical.

Archive still waits on EX-665 itself, which stays **In Review**: its 13 manual checks in
`context/foundation/manual-checks.md` are unticked and were rewritten during this gate, so they have
not been run against the shipped behaviour yet.
