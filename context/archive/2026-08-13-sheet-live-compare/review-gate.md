# Review-gate ledger — sheet-live-compare (+ dialog follow-ons) · 2026-08-14

Scope: `7f586e0f..HEAD` on `pomiar-bez-etapu` — 58 files, +4278/−580. Everything after the
`pomiar-bez-etapu` gate: sheet-live-compare p1–p6 plus the five follow-on commits on the sheet
dialogs. Run from the worktree `.claude/worktrees/pomiar-bez-etapu-review`
(branch `pomiar-bez-etapu-review`), because a parallel session holds `pomiar-bez-etapu` in the main
tree.

Out of scope: `context/changes/2026-08-14-sheet-column-mapping/` and the resolver work it owns
(`columns.ts`, `resolve-columns.ts` and their consumers) belong to a live parallel change — read,
report, but never mutate.

## Findings

**Trimmed at archive (2026-08-14).** Every `fixed` finding was dropped from the list below: its
durable record is the commit that fixed it, and re-reading the code answers the question better than
a paragraph asserting it was answered. What survives is the negative space git cannot hold — what was
looked at and deliberately NOT changed, and why. Pre-trim tally: 16 dismissed, 14 fixed, 6 dropped, 1 filed, 1 skipped · 0 open.

Two exceptions kept as one-liners, because they are the reason this slice was reviewed at all:

- 🔴 `build-measured-qty-refresh.ts` — opening the compare window NULLed every stored Pomiar on a
  sheet whose Pomiar column resolves to nothing (an optional column, so a supported sheet shape).
  Fixed in `5b65fdbc`, pinned by `build-measured-qty-refresh.test.ts`.
- 🔴 `kosztorys-actions-menu.tsx` / `kosztorys-sheet-measured-qty.ts` — the write moved rows without
  moving the investment's revision token, so the grid kept pre-write figures and the remount latch
  stayed armed for the next unrelated edit. Fixed in `5b65fdbc`, pinned by two DB-backed guards.

- [x] 🟡 WARNING · filed EX-691 · `impl-review` F4 · `src/lib/kosztorys/sheet-import/build-sheet-comparison.ts:83-92`, `footer-totals.ts:39-48` · App-side money is blind to an active global rabat. **Verified in the main thread:** `asClientPricing` spreads `...item` then forces `globalDiscountActive: false`, and `applyDiscount` (`calc.ts:45-49`) short-circuits on that flag — so with a global rabat active the editor prices rows gross of per-item rabat and subtracts once at the total, while the comparison applies every per-item rabat and omits the global one. Root cause is structural: `SnapshotSettingsT` (`snapshot-format.ts:35-39`) deliberately omits the global rabat so a restore can't reset it, so the comparison is never handed one. Consequence: both app-side totals disagree with the editor and the Podsumowanie, and matched prace land in `executedDiffs` as fabricated per-row differences — each a cell link inviting the owner to „fix" a sheet that is right. Fix by threading the investment's global rabat from the action (which already holds `investmentId`) rather than by widening the snapshot — the snapshot's omission is load-bearing.
      test: TDD · unit — `build-sheet-comparison`: a praca under an active global rabat produces no `executedDiffs` entry and app-side totals match the editor's.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` F14 (part) · `column-config.ts:20,37-38` · Three columns now start with „Pozostało": `divergence` = „Pozostało do rozliczenia" (sheet Pomiar − Σetapy) sits beside `remaining` / `remainingGross` (Przedmiar − Σetapy). In the column picker they read as variants of one figure; they are unrelated subtractions. **Dismissed on inspection:** the other two already carry a qualifier in their own labels, so the picker separates them today — and the new one is the sheet's own name for the figure, which outranks a qualifier we would invent.
- [x] 🔵 OBSERVATION · dropped · `impl-review` F12 + `code-review` · `build-measured-qty-refresh.ts:43-46`, `build-sheet-comparison.ts:143-146` · Both builders independently re-run `resolveRobocizna` + `parseRobocizna` over the full grid on every dialog open. Three linear passes, not an N+1, but pure duplicate work on a hot path that can carry 1000+ rows. Briefly reinstated as fix-now on the premise that F3 and F4 would change both signatures anyway. The premise did not survive: F3 needed no signature change, and F4 was filed rather than fixed. So it is back to a standalone refactor that would invalidate two spec harnesses, for a hot path measured in single-digit ms on a 435-row sheet. Dropped.
- [x] skipped · `impl-review` F14 (part) · `columns.ts:126,137` + two UI call sites · `FooterRowKeyT`'s `plannedNet` now denotes a footer row that defaults to `measuredNet`, and the misnomer has leaked into the two UI files that select the row by that key (it is the direct cause of the 🟡 above). A rename to `netValueRow` is right and the union is closed — but `columns.ts` is owned by the live parallel change `2026-08-14-sheet-column-mapping`, which this gate must not mutate. Hand it to that change rather than filing a duplicate.
- [x] dropped · `impl-review` F14 (part) · `read-sheet.ts:25` · `robociznaGid` is a Polish root on an English affix (AGENTS.md rule 3), but it joins the pre-existing `robociznaFormulas` / `resolveRobocizna` family — renaming it alone makes things worse, and the family rename is its own change. Flagged so the family doesn't keep growing.
- [x] dismissed · `impl-review` F15 · signature drift from the plan's contracts — `buildSheetComparison`'s third param, the injected db executor, the `result` prop rename, the spec named after the action that owns the write, and Phase 3 §2's skipped `p-0` layout (`ui/dialog.tsx:55` already ships `max-h-[90vh] overflow-y-auto`). All benign. The one item with teeth — the missing `build-measured-qty-refresh.test.ts` — is discharged by 🔴 #1's test obligation above.
- [x] dismissed · `impl-review` · success criteria · Phase 1's grep criterion returns 0 hits, typecheck is clean in every file this diff touches, lint has 0 errors, 112 unit tests and 106 DB-backed tests pass, and the DB spec asserts the persisted `sheet_measured_qty` via raw SQL rather than the action's return value. The zero-cennik resilience survives the rates change, verified end to end and pinned by a spec.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/lib/actions/kosztorys-import.ts:130,138` · `buildMeasuredQtyRefresh` and `buildSheetComparison` each re-run `resolveRobocizna` + `parseRobocizna` over the same grids — a 1000+ row sheet is parsed twice per dialog open. Real but not worth reshaping a shipped API for at current sizes.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `formula-health.ts:73-77`, `build-sheet-comparison.ts:56` · `samples.*` and `executedDiffs` are unbounded, so a sheet whose whole Pomiar column is `=N<row>` sends one wire entry per praca. DOM is fine (Radix unmounts closed folds); payload size is the only cost, small at current datasets.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `formula-health.ts:118` · `totalRows` counts rows above the first section header that the parser skips, so the denominator can exceed what would import. Benign — the block judges our reading of the sheet, not the import.
- [x] dismissed · `code-review` · `src/lib/db/kosztorys-sheet-measured-qty.ts:15-27` · Raw-SQL write bypasses Payload collection access. Not a regression: `protectedAction` gates on the same role set, and `KOSZTORYS_TREE_TAGS` already covers the cache tag the skipped hook would have revalidated.
- [x] dismissed · `code-review` · `build-sheet-comparison.ts:83-101` · `asClientPricing`/`asPlanePricing` force `globalDiscountActive: false`; `subcontractorPrice`/`effectiveCoeff` never read the flag, so no false stale-rate rows.
- [x] dismissed · `code-review` · `footer-totals.ts:143` · `measuredNetTotal` coerces with a local ternary rather than the parser's `number()`. Identical behaviour on every input the UNFORMATTED_VALUE grid can produce.
- [x] dismissed · `code-review` · `globals.css:376`, `kosztorys-v2-columns.tsx:294` · The `kosztorys-section-name-cell` → `kosztorys-identity-cell` rename looks half-done; both classes are live, the old one still carries the section-footer rule at `globals.css:414`.
- [x] dropped · `code-review` · `sheet-rates-block.tsx:32-42` · Verdict precedence hides the conflict count when stale rates are also present. Both folds still render; cosmetic.
- [x] dropped · `code-review` · `hooks/use-sheet-import.ts:25-39` · Two fast clicks race two sheet reads and the last to resolve wins. Pre-existing pattern shared with `handleOpenShare`/`handleOpenCompare` — a request-id guard belongs to all three at once, not to this slice.
- [x] dismissed · `module-cohesion` · `sheet-report-parts.tsx`, `sheet-compare-dialog.tsx`, `sheet-import-dialog.tsx`, `sheet-rates-block.tsx` · Proposed splitting every private sub-block into its own file and hoisting `SHEET_SIDE`/`APP_SIDE`/`ReportCellT` into `constants.ts`/`types.ts`. Dismissed: `structure-scatter` independently judged the same four files a single coherent home with one-way dependencies, and the repo's own `dialogs/` convention already colocates block helpers beside their dialog. Splitting a private `RatePair` into its own file would scatter, not cohere.
- [x] dismissed · `comment-noise` · `sheet-report-parts.tsx:24` · Borderline comment partly restating the alignment ternary below it, but it also carries the legibility rationale for two alignments. Kept.
- [x] dismissed · `tailwind-v4` · `kosztorys-editor-body.tsx:185,331` · Arbitrary `h-[calc(100dvh-7rem)]` and inline `style={{ left: guideX }}` are both legitimate v4 exceptions (one-off viewport geometry; a runtime drag position no utility can express). No 640px breakpoint introduced anywhere.
- [x] dismissed · `feature-first-structure` / `structure-scatter` · whole slice · Both audits returned zero findings: every new module landed in the layer AGENTS.md prescribes, and every new spec mirrors its full source path.
- [x] dismissed · `simplify` · `sheet-compare-dialog.tsx:141,229,249` · The bare `<p className="text-xs …">` note is now six occurrences in this file and looks like a `<Note tone>` extraction waiting to happen. It predates this slice at four of them, so the extraction is a file-wide refactor, not a fold of my two new lines into an existing helper — my additions follow the established idiom rather than adding a competing one.
- [x] dismissed · `simplify` · `kosztorys-actions-menu.tsx:102`, `sheet-compare-dialog.tsx:245` · The „did the refresh write anything" predicate appears at both ends (`updated + cleared > 0` and its inverse). A shared helper cannot live beside the type in `kosztorys-import.ts` — a `'use server'` module may export only async functions — and a third module for one addition buys nothing the expression doesn't already say.
- [x] dismissed · `simplify` · `kosztorys-import.ts:150-153` · `updated`/`cleared` are counted from `rows` while the remount gate keys on `written`, so in principle the dialog could claim a write the database refused. It cannot: the ids come from `serializeKosztorys(investmentId)` and the statement now filters on that same `investment_id`, so `rows.length > 0 ⟺ written > 0`. Reshaping the counts to derive from `written` would trade a real invariant for a defensive one.
- [x] dismissed · `comment-noise` · whole slice (44 files) · Zero deletions, zero trims. The renames in this slice had their explanatory comments rewritten in step with the code rather than left stale; the Polish tokens inside English comments are quoted sheet proper nouns, which is the required convention.

## Simplify pass

Ran the simplify pass over the Step-1 fixes only (the parallel session owns `columns.ts` /
`resolve-columns.ts` / `context/changes/2026-08-14-sheet-column-mapping/` and was never touched) —
1 applied, 0 proposed, 3 dismissed; each folded into `## Findings` above tagged `simplify`. No
separate report file: this ledger is the single source of truth.

## Tests & suite

- `pnpm generate:importmap` — the worktree had no generated import map, so typecheck failed on three
  `(payload)` files before anything of this slice was read. Generated, artifact is gitignored.
- `pnpm typecheck` — clean.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import src/__tests__/components/kosztorys/editor/dialogs` — 107/107 pass (10 files), including the two new `build-measured-qty-refresh` guards.
- `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-compare-with-sheet.test.ts` against `db-test` (5435) — 6/6 pass, including the two new revision-token guards.
- Full suite (`lint`, whole `test`, `build`) and `test:e2e` — not run; owner's call, and e2e is never run unprompted.
