# Review-gate ledger — kosztorys-filter-conditions (EX-665) · 2026-08-14

Scope: `3980109b..HEAD` (23 files). Verification pass (Step 0.5) skipped — no browser-verification
skill in this install.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `comment-noise-audit`,
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`. All five returned.
`tailwind-v4-audit` came back clean — every scanner hit was pre-existing code outside the range or
canonical v4 syntax in stock shadcn; its one standing item (no Tailwind-aware ESLint plugin in the
repo) is out of diff and dropped.

## Findings

_Trimmed at archive (2026-08-14)._ Every `fixed` finding was removed: its durable record is the
commit that landed it, and the code itself now answers the question. What survives is the negative
space git cannot hold — what was judged benign, dropped as not worth the churn, or deliberately left
alone, each with the reason. Pre-trim tally: **13 fixed, 5 dismissed, 5 dropped, 2 skipped · 0 open.**

- [x] 🟡 WARNING · dismissed (code) / fixed (docs) · code-review + impl-review F6 ·
      `section-band-rows.ts:12` · the fold is no longer suppressed by conditions, while the comment
      still claimed „search **or a condition**". The **code is right**: conditions and folds are
      ticked in the same „Filtry" menu, so suppressing the fold would make those checkmarks describe
      nothing, and it would kill the „Sekcje bez wykonanych prac" row outright. Comment corrected in
      `section-band-rows.ts` and `use-kosztorys-editor.ts:451`. **Behavioural call worth the owner's
      eye:** a strict condition can still leave hits sealed under a fold set earlier.
- [x] 🟡 WARNING · dropped · impl-review F1 · `use-engaged-conditions.ts:11` · the persisted
      localStorage map is not versioned, so a key written before the semantic inversion is reread
      under the new meaning. Only reachable on a dev machine that used the pre-`c6c32570` build; the
      renamed ids are no-ops and the survivors are one click to undo. Not worth a migration for two
      browsers.
- [x] 🟡 WARNING · dropped · impl-review F4 · `use-kosztorys-editor.ts:359,424` · ~ten full-dataset
      passes per recompute, and `foldableSectionIds` is not preview-gated. Each is a memo over ≤1000
      rows; the profile that would justify restructuring the hook doesn't exist yet, and the hook's
      split is the EX-515-deferred unit.
- [x] 🟡 WARNING · dismissed · impl-review F2 · `kosztorys-filters-menu.tsx:91,103` · the trigger
      count excludes diagnostics while the reset's `disabled` includes them. Deliberate and
      documented: nothing in the menu is ticked for a diagnostic, so counting one produced
      „Filtry (2)" over an untouched list — but reset genuinely clears it.
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
