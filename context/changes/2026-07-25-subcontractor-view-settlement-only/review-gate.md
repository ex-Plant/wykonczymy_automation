# Review-gate ledger — subcontractor-view-settlement-only (EX-571) · 2026-07-25

Scope: the slice's own commits on branch `subcontractor-view-settlement-only`
(`69290c80`, `5003e50d`, `6634d16b`, `e551ac25`, `c4156e28`, `bc8126ed`, `4ffc3031`) — NOT the
parallel agent's commits that landed on the same branch (`a53d603f`, `337a5ee7`, `dcde20c7`,
`516bb701`).

Step 0.5 (browser verification pass) **not run** — needs the app + seeded 5435 test DB;
manual checks are registered in `context/foundation/manual-checks.md` under `## EX-571`
and stay the archive blocker.

Fan-out: `/10x-impl-review` (verdict REJECTED), `/code-review`, `comment-noise-audit` (flag-only),
`feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`, `tailwind-v4-audit`
(clean). impl-review and code-review found the same single critical independently.

**Process incident:** the impl-review agent reverted the main thread's working-tree fix three times
(`git checkout --`), reading it as an unauthorized sub-agent edit. Nothing was lost — the fix was
re-applied and committed as `4ffc3031`. Lesson for the next gate: commit a fix before dispatching or
while agents are still live, or they will treat a dirty tree as contamination.

## Findings

- [x] 🟡 WARNING · filed EX-572 · impl-review F7 + code-review · `v2-columns-readonly.test.ts:43`, `kosztorys-empty-sections.test.ts:53` · nothing pins the slice's central promise (which columns exist per view) — the readonly spec asserts only absences and would stay green if every stage column vanished; the empty-sections fixture still carries the `plane: null` vacuity the plan promised to remove. Same shape as the critical's hiding place, which is why it is filed rather than dropped. Not fixed here: writing the column-set assertions is its own test-authoring task.
      test: TDD · unit — disposition recorded on EX-572 so the guard travels with the fix.
      **Partly discharged in the `/simplify` pass:** the przedmiar-anchored column-set assertions now
      exist (`v2-columns-readonly.test.ts`, +2 specs) because `/simplify` moved that filter to the
      selection chokepoint and the new mechanism owed a guard. EX-572 still owns the rest: the
      per-etap column-set assertions and the `plane: null` fixture vacuity in `kosztorys-empty-sections.test.ts`.

- [x] 🔴 CRITICAL · fixed · impl-review F1 + code-review · `src/lib/kosztorys/settlement.ts:249` · `stageTotalsForView` made its denominator view-scoped but kept distributing the row's net over every stage, so an out-of-view etap took a share > 1 — Σ per-etap overshot „Razem" by a multiple. Reachable: the panel's „Robocizna" tab is no longer coupled to the price view, so it rendered the other crew's etap at this crew's price. Fixed in `4ffc3031` with `stageAppliesToView` in the inner loop.
      test: test-driven-debugging · unit — red repro asserted Σ stageTotals ≈ Σ rowValueForView per subcontractor view (caught 36 where 0 was owed), plus explicit per-etap figures. Green.
- [x] 🟡 WARNING · fixed · impl-review F2 + code-review · `src/__tests__/lib/kosztorys/kosztorys-settlement.test.ts:49` · both fixture stages were `plane: null`, so every subcontractor-view assertion in the file compared 0 against something and passed for the wrong reason — this is why the critical shipped green. Fixture now carries one etap per plane. `4ffc3031`.
      test: TDD · unit — the corrected fixture is itself the guard.
- [x] 🟡 WARNING · skipped · impl-review F4 + code-review · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:389` · per-etap „% wykonania" is przedmiar-anchored and survives in subcontractor views while every other przedmiar-anchored column was hidden. **Owner decision 2026-07-25: keep the columns.** Taken the review's stated alternative — the tip now names the base out loud (`header-tips.ts`), because the reader can no longer see the denominator on screen.
      test: no automated test — column-set coverage is out of scope per the plan; covered by the EX-571 manual checks.
- [x] 🟡 WARNING · fixed · impl-review F5 + feature-first + scatter · `kosztorys-v2-columns.tsx:70` · `razemLabel` is a Polish root on an English affix (AGENTS.md glossary rule 3), and it produces a column label outside `column-config.ts`, which declares itself the single source for header + picker — the two already disagreed on screen („Razem Netto — po rabacie" vs „Razem Netto"). Renamed and rehomed; picker routed through it.
- [x] 🟡 WARNING · fixed · code-review · `kosztorys-v2-columns.tsx:304` + `header-tips.ts:17` · „Pomiar (razem etapy)" silently became one crew's pomiar while its label and tip still said „wszystkich etapów". The slice disambiguated the money („Razem") and left the quantity it derives from undisambiguated.
- [x] 🟡 WARNING · dropped · impl-review F3 · `kosztorys-v2-columns.tsx:442` · the Klient header also gained „— po rabacie", and the suffix was applied to Brutto too — both beyond the plan's wording, both coherent and already recorded in `manual-checks.md:200`. Code is the better behaviour; a plan addendum for shipped-and-documented wording is not worth the churn.
- [x] 🟡 WARNING · dismissed · impl-review F6 · `69290c80` · a parallel agent's `RowActionsCell` hunk rode along in the phase-1 commit, so that commit likely does not typecheck standalone. Real, but unfixable without rewriting shared history on a branch another agent is committing to — and `header-tips.ts` (the second half of this finding) is squarely this slice's concern, just unrecorded. Going forward the staging discipline already applied (explicit paths) is the guard.
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/settlement.ts:147` · `hasUnconfirmedPlane` ignores whether the unassigned etap carries any qty, but the hint it drives now asserts money is missing. A freshly added empty etap made that claim false. Gated on qty.
- [x] 🔵 OBSERVATION · fixed · impl-review F9 + comment-noise · `kosztorys-v2-columns.tsx:281`, `settlement.ts:217`, `subcontractor-summary.tsx:164`, `stage-header.tsx:79`, `kosztorys-editor-body.tsx:117`, `header-tips.ts:7` · comment noise the slice accreted: vanished-state narration about the deleted `naStageValueColumn`, a rationale about view-switch blinking that is now unreachable, and a comment that translates the Polish string on the next line. Trimmed to the load-bearing why.
- [x] 🔵 OBSERVATION · fixed · feature-first + scatter · `src/components/ui/plane-unconfirmed-badge.tsx:4` · the comment still documented the rule this slice reversed („etap bez rozliczenia liczy się jako z narzędziami"). A false comment in a file the slice's behaviour change invalidated.
- [x] 🔵 OBSERVATION · skipped · code-review + comment-noise · `subcontractor-summary.tsx:93,164` · stale rationale (justifies the missing read-only fallback with a gating mechanism that no longer exists) and a comment translating the Polish string below it. Both real; the file is a parallel agent's uncommitted work, which is the one file-based hold the gate honours — editing it would clobber their in-flight changes.
- [x] 🔵 OBSERVATION · dropped · impl-review F8 + code-review · `use-kosztorys-editor.ts:348`, `kosztorys-editor-body.tsx:106` · przedmiar-anchored totals still computed on every view switch for columns that don't exist in subcontractor views. Wasted O(rows) work, never incorrect. Not worth the branch — and F4's decision to keep the percent columns means the przedmiar is no longer entirely absent from those views anyway.
- [x] 🔵 OBSERVATION · dropped · impl-review F10 · `use-kosztorys-editor.ts:392` · `discountAmount` is internal-only post-change and `rabatAmount` is a pure alias of `rabatClientNet`. Cosmetic renaming inside a hook already queued for splitting (EX-515).
- [x] 🔵 OBSERVATION · dropped · code-review · `kosztorys-v2-columns.tsx:102` · `text-destructive` never wins on the three stage-value columns — `ComputedCell` paints its own span with the column's `className`. The background tint still lands, so the alert reads; matching the text colour would mean threading a variant through `computedColumn` for a cosmetic gain.
- [x] 🔵 OBSERVATION · dropped · code-review · `kosztorys-v2-columns.tsx:104` · a multi-column paste spanning a locked etap silently drops that column (dsg skips disabled cells without warning). Inherent to `disabled`; the lock is the point, and picking a rozliczenie costs one click.
- [x] 🔵 OBSERVATION · dropped · code-review · `settlement.ts:293` · „Ukryj puste sekcje" now means "no work by this crew" in a subcontractor view. Defensible and consistent with every other figure on those views.
- [x] dropped · tailwind-v4-audit · `kosztorys-v2-columns.tsx:105` · `bg-destructive/15` is the repo's only `/15` (ladder is /5 /10 /20 /40 /50 /90). Cosmetic; the intended contrast against the `/10` cells is exactly why it sits between them.
- [x] dropped · scatter + feature-first · `plane-icons.tsx`, `KosztorysGlobalSettings`, `PriceViewT` home, `src/lib/kosztorys/` (36 flat files) · pre-existing placement issues the slice merely brushed against. Real, but each is a move-and-update-imports refactor with its own blast radius — and `KosztorysGlobalSettings` is a parallel agent's live file.
- [x] dismissed · module-cohesion · `use-kosztorys-editor.ts` (1135 LOC) · god module, already tracked as EX-515 with the hook split deliberately deferred pending a test harness. Not re-litigated here.
- [x] dismissed · scatter + feature-first · `RABAT_IS_CLIENT_ONLY` (`header-tips.ts`) vs `RABAT_SUBCONTRACTOR_NOTE` (`summary-settings-bar.tsx`) · same fact, two homes. The second constant is a parallel agent's uncommitted work — the one file-based hold the gate does honour. Cannot be deduped from here without clobbering it.
- [x] dismissed · code-review · `kosztorys-v2-columns.tsx`, `kosztorys-totals-row.tsx` · no dsg cell-remount hazard introduced (EX-422): all three `component` vectors stay module-level; `planeUnconfirmed` contributes only `disabled`/`className`.
- [x] dismissed · code-review · `use-kosztorys-editor.ts:308-358` · no stale memo deps; every memo consuming `view` lists it, and the two that omit it are view-independent by construction.
- [x] dismissed · code-review · `use-kosztorys-editor.ts:386` · the global-discount re-anchoring is correct, and the old form would have read 0 in subcontractor views.
- [x] dismissed · code-review · `sort-value.ts:40` · all `rowTotalQtyDone` call sites threaded with `view`; the no-default-parameter strategy caught them, confirmed by `tsc`.
- [x] dismissed · code-review · `stage-keys.ts` et al · the „nie dotyczy" apparatus is fully removed; dead-code deletion gated on typecheck, not grep.
- [x] dismissed · module-cohesion · `settlement.ts`, `stage-keys.ts`, `kosztorys-totals-row.tsx` · scanner-flagged, judged cohesive: each is one concern, and the exported types are the return contracts of functions in the same file.
- [x] dismissed · tailwind-v4-audit · whole diff · 0 hits across all three v4 groups; `bg-destructive/10 text-destructive` is the established repo pair.

### `/simplify` pass (Step 2)

- [x] fixed · simplify · `kosztorys-v2-columns.tsx:70` · **the label-resolution hole** (3 of 4 agents). `columnLabelForView` was wired into 3 of ~21 headers while the column picker always used it, so a fourth view-dependent label would render correctly in the picker and wrongly in the header — the exact drift `column-config.ts` exists to prevent, reintroduced one header at a time. `title()` now resolves the label from `field` itself; all 22 call sites pass only the id. The two-source failure mode is gone by construction.
- [x] fixed · simplify · `kosztorys-v2-columns.tsx` + `column-config.ts:72` · **four copy-pasted `view === 'client' ? […] : []` ternaries** (3 of 4 agents) replaced by `PRZEDMIAR_ANCHORED_COLUMNS`, applied at both selection chokepoints. Now there is a list you can read to answer "which columns are przedmiar-anchored", and a przedmiar-derived column added later must opt in rather than silently ship the one-crew-numerator-over-everyone's-denominator comparison.
- [x] fixed · simplify · `v2-columns-readonly.test.ts:65` · the guard the line above owes: the filter moved from assembly to selection, so a column that starts being built unconditionally can only leak through the new chokepoint. Two specs assert the built grid per view, not the set constant (which would restate itself).
- [x] fixed · simplify · `settlement.ts:60` · four sites re-derived the view's own etapy inline, which made a bare `for (const st of stages)` inside view-scoped code look normal — the shape that produced the 🔴 above. Extracted `stagesForView`, idempotent so the filtered array is safe to hand onward.
- [x] fixed · simplify · `settlement.ts:249` · `stageTotalsForView` re-filtered the stage list once per row. Hoisted; the seed still spans **all** stages so an out-of-view etap reports 0 instead of vanishing.
- [x] fixed · simplify · `settlement.ts:293` · `sectionSubtotalsForView` both re-filtered per row **and** computed the pomiar twice — once for the net, once for the rabat. One `qtyDone`, reused: value and discount now stand on the same quantity by construction.
- [x] fixed · simplify · `settlement.ts:147` · `hasUnconfirmedPlane` walked the stages a second time and re-derived `stageKey`. Folded into the existing loop; `||=` short-circuits once it's true.
- [x] fixed · simplify · `kosztorys-v2-columns.tsx` (per-cell computes) · every przedmiar-anchored compute took `view` as if a subcontractor reading existed — false generality, since the set above drops those columns outside the client view. Hard-anchored to `'client'`, so the formula states what is actually true.
- [x] fixed · simplify · `kosztorys-v2-columns.tsx:102` · `planeUnconfirmed` returned a fresh object mixing colour and `disabled`. Split: `PLANE_UNCONFIRMED_CELL` is a module-level `as const` (dsg identity, EX-422), and `disabled` moved inline onto `stageCols` — the three value columns are already read-only, so the flag said nothing about them.
- [x] fixed · simplify · `use-kosztorys-editor.ts:392` + `settlement.ts` · the global rabat was computed twice: once inside `clientTotalsFromSubtotals`, once again in a `discountAmount` memo in the hook. `KosztorysClientTotalsT` now carries `globalRabatNet`; the memo and the `rabatAmount` alias are deleted. This is impl-review F10's dropped finding, now fixed rather than parked — it stopped being cosmetic once the duplication was the reason it existed.
- [x] fixed · simplify · `kosztorys-v2-columns.tsx` (cell renderers) · per-cell `rowTotalQtyDone(r, stages, view)` re-filtered on every render. Threaded `viewStages` through.
- [x] fixed · simplify · `use-kosztorys-editor.ts`, `kosztorys-v2-columns.tsx` · dead code the slice left behind: unused `PriceViewT` / `executedWorkNetPreRabat` imports (pre-existing — confirmed by stashing the working tree) and the now-unused `COLUMN_LABELS` import. Gated on typecheck + lint, not grep.
- [x] fixed · simplify · `settlement.ts:293` · `sectionSubtotalsForView` accumulated `plannedNet` unscoped, so a section subtotal's przedmiar spanned the whole scope while its net spanned one crew — one crew's numerator over everyone's denominator. Initially skipped as a domain call; **owner ruling 2026-07-25: the subcontractor view is an internal preview, not a screen the crew sees, so the przedmiar has nothing to describe there — block it.** `plannedNet` is now `number | null`, withheld outside the client view (`null`, not 0 — 0 would claim nothing was offered). Enforced structurally: `sectionSubtotalsForView` is overloaded on the `'client'` literal and returns `SectionSubtotalClientT`, so the two pinned consumers (progress counter, section pie) keep a non-null figure with no `?? 0` noise while the one view-aware consumer — the „Razem" row — is forced by `tsc` to branch. The previous guard was only the hidden columns; the value was still computed and would have leaked silently the day someone surfaced it.
      test: TDD · unit — two specs in `kosztorys-settlement.test.ts`: `null` in both subcontractor views, 132 in the client view.
- [x] dropped · simplify · `kosztorys-v2-columns.tsx` · dedup the three per-etap value-column builders (qty / net / gross) into one parameterised factory. The agent rated its own confidence low at three call sites, and the three bodies differ in enough small ways that the factory would carry more configuration than the duplication costs.
- [x] dismissed · simplify · `header-tips.ts` · header tips read the same in every view. Duplicate of impl-review F4 — already the owner's explicit decision 2026-07-25, not an oversight.
- [x] dismissed · simplify · `subcontractor-summary.tsx` · findings reported but not applied: the file carries a parallel session's uncommitted work, the one file-based hold the gate honours (hard-excluded in the agents' brief).

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude), scoped to the slice's own
commits and with `subcontractor-summary.tsx` hard-excluded (parallel session's uncommitted file) —
**13 applied, 0 proposed, 3 dismissed/dropped, 0 skipped**; each folded into `## Findings` above,
tagged `simplify`. No separate report file, per the gate's one-list rule. Every agent was given an
explicit ban on `git checkout` / `restore` / `stash` after the Step-1 incident; none touched the tree.

## Tests & suite

- `pnpm exec vitest run src/__tests__/lib/kosztorys/` → 264 passed / 11 skipped (was 262 + 2 new guards).
- Post-`/simplify`: `pnpm typecheck` clean; ESLint clean on the five touched files;
  `pnpm exec vitest run src/__tests__/lib/kosztorys/ src/__tests__/components` → 278 passed /
  11 skipped (276 + 2 new przedmiar-column guards), 21 files passed / 3 skipped.
- After the przedmiar block: `pnpm typecheck` clean; ESLint clean on the five touched files;
  the same run + `kosztorys-chart-slices.test.ts` → 285 passed / 11 skipped, 22 files passed / 3 skipped.
- **Full suite (Step 3), minus e2e — user's call, `test:e2e` not run** (needs the 5435 `db-test`
  container up; the browser-level obligation stays with EX-571's manual checks + the E2E backlog):
  - `pnpm typecheck` → clean.
  - `pnpm lint` → 0 errors, 87 warnings, all pre-existing (`src/migrations/*` unused-arg noise plus
    ~22 unrelated files). None in a file this slice touched.
  - `pnpm test` → **1141 passed / 51 skipped**, 91 files passed / 20 skipped. The Nodemailer
    `ECONNREFUSED 127.0.0.1:465` stderr is from the skipped preset specs, not a failure.
  - `pnpm build` → succeeded, full route table emitted.

## Archive

Archived 2026-07-25 with the 16 EX-571 manual checks still open — **by design, not as a waiver**:
they live in the shared registry `context/foundation/manual-checks.md` under `## EX-571`, which is a
`foundation/` doc and does not travel with the change folder. Archiving the folder therefore drops
nothing; the verification work stays exactly where it is tracked, and the slice's Linear issue stays
open as the one outstanding thread.

If a figure is ever disputed, two checks are the ones to run first: „Razem Netto" (Z) + „Razem Netto"
(Bez) against „Suma wykonanej pracy" in Podsumowanie podwykonawców, and typing into an etap ilość
cell after the column rebuild (EX-422's remount shape — this slice touched column identity).
`test:e2e` was not run either, so both are browser-level and undischarged.
