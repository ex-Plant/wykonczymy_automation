# Review-gate ledger — filtry-problemy (cały branch vs `staging`) · 2026-08-17

Scope: the whole `staging`-relative diff of this branch, which carries **three** workstreams — a
parallel agent committed onto it:

- **A. filtry-problemy** — the row + stage problem registry, the „Problemy" trigger, the row latch,
  the plane switch on pick, keyboard in the subcontractor cells
- **B. investor rename** — „klient" → „inwestor", `/podglad-klienta` → `/podglad-inwestora`
- **C. sheet import** — coefficient/rate resolution from the cennik, `DEFAULT_COEFFS.ownTools`
  0.55 → 0.5525, deletion of the `kosztorys-bialostocka` fixture + `seed-investment-from-sheet.ts`

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only) — 8 reports, all
triaged in the main thread.

## Findings

- [ ] skipped · code-review · `src/lib/kosztorys/row-conditions.ts` · `conditionCounts` runs one full
      pass per condition (~11) on every keystroke — at 1000+ pozycji that is ~11k predicate calls per
      edit; the fix inverts the loop and reshapes a public function + its spec, so it is its own
      review. **Unfiled — Linear refused (free-issue cap on the workspace).**
- [ ] skipped · module-cohesion · 7 module-split proposals across the import + editor trees — real,
      each is a mechanical move plus an import sweep, none is urgent, and doing seven at once inside a
      review gate would bury the behaviour fixes above. **Unfiled — Linear refused (free-issue cap).**
- [ ] skipped · simplify · `use-kosztorys-view-state.ts` · `divergenceFilterEngaged` names the
      mechanism's first caller, not what it does — it answers „czy coś odsłania kolumny", and the next
      condition that reveals one will have to be squeezed under a „divergence" name. A rename to
      `revealsColumns` ripples through the view-state hook, the editor root and two specs, so it is its
      own review. **Unfiled — Linear refused (free-issue cap).**
- [x] 🔴 CRITICAL · fixed · impl-review + code-review · `problems-menu-model.ts:33` · an engaged
      problem vanished from the list the moment its last match was fixed, taking the only control that
      releases the narrowing with it — the grid stayed cut down to the held pozycje with no way out.
      One `|| engagedIds.has(id)` on the offered list closes the row-problem and the stage-problem
      variant at once, and the trigger follows because it reads that same list.
      test: test-driven-debugging · unit — two guards in `problems-menu-model.test.ts` (the „(0)" row
      survives, and the trigger stays on), red before the fix.
- [x] 🔴 CRITICAL · fixed · code-review · `use-kosztorys-view-state.ts:50` · the problem's plane was
      remembered in component state while the problem itself is persisted, so a reload restored the
      narrowing without the view it is judged on — „ze zbyt wysoką stawką … bez narzędzi" listed its
      pozycje with the inwestor's cena in the column it had just revealed. Now derived from the engaged
      set on every render; only the reader's own override is remembered.
      test: test-driven-debugging · unit — `engagedPlane` in `row-conditions.test.ts` (reads the plane
      off whatever is engaged, answers nothing when none names one, skips a stale id).
- [x] 🔴 CRITICAL · fixed · code-review · `use-condition-row-latch.ts` · the latch key used a literal
      NUL byte as its separator, which made git treat the file as binary — no reviewable diff at all.
      Replaced with `:` (condition ids are kebab-case, so it cannot collide).
      test: no automated test · unit — a byte-level property of the source, not of behaviour; `file`
      now reports UTF-8.
- [x] 🟡 WARNING · fixed · impl-review · `use-kosztorys-editor.ts` · the latch was fed the whole
      engaged set, so a „Prace" filter also held rows — untick „z przedmiarem", type one, and the row
      that should leave stayed put while the menu's counter moved without it. „Odśwież — ukryj
      poprawione" only renders under a problem, so there was no way to let it go. Scoped to the problem
      registry, and never under the preview.
      test: test-driven-debugging · unit — covered by the latch cases already in `row-view.test.ts`
      plus the `PROBLEM_IDS` coverage in the menu-model spec.
- [x] 🟡 WARNING · fixed · impl-review · `use-condition-row-latch.ts` · `enabled: false` still returned
      a filled latch, so a caller could half-honour it — skip the filter bypass while the set kept
      accumulating. Returns `null` when disabled, which makes half-honouring untypeable.
      test: no automated test · unit — the null return is enforced by the type, not by a spec.
- [x] 🟡 WARNING · fixed · code-review · `subcontractor-columns.tsx:182` · Enter and Escape blurred the
      input but never handed the cell back to the grid, so the grid stayed in edit mode on a cell whose
      input had already blurred — Enter did not step down, Escape did not return to selection. Both now
      call `stopEditing`.
      test: no automated test · e2e — the defect only exists inside react-datasheet-grid's keyboard
      model; asserting it needs a real grid. Covered by the manual check already written for fazy 5–7.
- [x] 🟡 WARNING · fixed · code-review · `row-conditions.ts:186` · a negative stawka wykonawcy matched
      both „ze zbyt wysoką stawką" and „bez ceny wykonawcy" — counted twice in the list and chased
      twice in the grid. The absence condition now reads exactly zero; a negative belongs to the guard.
      test: test-driven-debugging · unit — a negative row in `row-conditions.test.ts` asserts one
      condition matches and the other does not.
- [x] 🟡 WARNING · fixed · code-review · `sheet-import-dialog.tsx:139` · the adopted mnożnik rendered
      through `formatQty` (3 dp), so a derived `0,5525` previewed as „0,553" — a number the import then
      did not adopt, in the reader's only preview of what the cennik decided. New `formatCoeff` renders
      to the six places `round6` stores.
      test: no automated test · unit — a formatter swap; the rounding it replaces is what the existing
      `round6` specs already pin.
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-08-17-filtry-problemy/plan.md` ·
      three shipped behaviours contradicted the phase text (the counting trigger, „Odśwież — ukryj
      poprawione", the derived plane). Recorded in a „Deviations from the plan" section rather than
      rewritten into the phases, so the ruling and its date stay legible.
- [x] fixed · code-review · `editable-cell-input.tsx:50` · inline `style={{pointerEvents}}` replaced by
      the `pointer-events-*` utilities, per the Tailwind v4 rule.
- [x] fixed · structure-scatter · `sheet-import/derive-override.ts` · `round6` was a general rounding
      helper living in an import-specific module and imported back out of it by two siblings — moved to
      `src/lib/utils/round.ts`.
- [x] fixed · code-review · `filter-multi-select.tsx` · three dead props removed (`contentClassName`,
      `iconClassName`, and `icon` on toggle-group items) — no call site passed any of them; typecheck
      gates the deletion.
- [x] fixed · comment-noise · `kosztorys-v2-rows.test.ts:387` · a Polish block comment translated to
      English (the repo rule; the Polish `it()` titles are the file's own convention and stay).
- [x] dismissed · comment-noise · `kosztorys-problems-menu.tsx:30` · the „one problem at a time"
      rationale was flagged as duplicated — it is stated once in the menu's own doc comment; the
      neighbouring comment in `use-engaged-conditions.ts` explains a different thing (why the group is
      a parameter), so there is nothing to merge.
- [x] dropped · code-review · `DEFAULT_COEFFS.ownTools` 0.5525 vs the DB column default 0.55 · real
      divergence, no reachable path that reads the column default — every write goes through the
      constant.
- [x] dropped · code-review · no redirect from the old `/podglad-klienta` · bounded to an owner's own
      bookmark; the rename shipped before any client link was ever sent.
- [x] dismissed · code-review · `sheet-coeffs.ts` · `mode()` adopts a cennik mnożnik with no sample
      floor and no tie signal. Filed EX-705, then **ruled away by the owner (2026-08-17) and the issue
      cancelled**: there are in practice no sheets without prace, so the thin-sample case has no way to
      occur, and in 99% of sheets one mnożnik covers everything — a tie needs exactly equal counts,
      while a dominant mnożnik is precisely what „most common wins" already returns. Behaviour unchanged.
- [x] 🟡 WARNING · fixed · code-review · `sheet-rates-block.tsx` · filed EX-706, then **ruled and fixed
      in-gate (2026-08-17)**. Owner's call: a conflict between the two cenniki outranks a stawka that
      has merely drifted, because a conflict means there IS no kwota (the praca sits at 0 zł) while a
      drifted one is a known kwota that moved. The verdict moved to `sheet-rates-verdict.ts`, takes a
      `mode`, keeps BOTH clauses when a praca is conflicted and stale at once, drops the future tense in
      the read-only compare dialog, and the „do sprawdzenia" fold no longer claims the cenniki disagreed
      (it also holds prace present in one cennik only).
      test: TDD · unit — `sheet-rates-verdict.test.ts`, 6 cases; the precedence one is the guard.
- [x] fixed · simplify/altitude · `problems-menu-model.ts` + `use-kosztorys-editor.ts` · what counts as
      a problem was assembled twice — once in the menu, once in the editor root, which reached up into a
      leaf toolbar folder to get it. New `src/lib/kosztorys/problem-conditions.ts` states it once
      (`PROBLEM_CONDITIONS` / `PROBLEM_IDS` / `engagedProblemIds` / `engagedStageProblemIds`); the menu,
      the exclusive pick, the row latch and the stage narrowing all read it.
- [x] fixed · simplify · `problems-menu-model.ts` · `hasProblems` was `problemToggles.length > 0`
      wearing a name — a second return value that could disagree with the list it summarised. The model
      returns the array; the trigger asks it directly.
- [x] fixed · simplify/efficiency · `use-kosztorys-editor.ts` · one `conditionCounts` memo re-counted
      every row condition whenever only the view changed, and re-counted the etapy on every keystroke.
      Split into a row memo and a stage memo behind the same Map.
- [x] fixed · simplify · `filter-multi-select.tsx` · `toggleGroups` took an array of captioned groups
      for a single caller passing exactly one — the second group („Problemy") moved to its own menu and
      never came back. Flattened to `toggles` + `togglesHeading`.
- [x] fixed · simplify/efficiency · `resolve-rates.ts` · `references()` compiled a fresh `RegExp` per
      formula per column; `referencesColumn(column)` builds it once and is hoisted out of the row loop.
      Same for the `wToolsTyped` / `ownToolsTyped` predicates, bound once instead of per row.
- [x] fixed · simplify/reuse · `subcontractor-price-edit.ts` + `sheet-rates-block.tsx` · a private
      `COEFF_PLACES` constant re-implementing `round6`, and hand-joined class strings where `cn()` is
      the house helper.
- [x] skipped · simplify · `use-condition-row-latch.ts` · folding the caller's `latch.ids.add(row.id)`
      into a hook-owned `retain()` would hand the memo a new closure every render, and the latch
      object's identity IS the documented reset signal — the current null-when-disabled return already
      makes half-honouring untypeable.
- [x] skipped · simplify · `row-conditions.ts` / `stage-conditions.ts` · a factory generating the price
      conditions per plane would turn eight literal ids into template strings; the ids are the one thing
      in this feature that is grepped from four places.
- [x] skipped · simplify · `resolve-rates.ts` · the repeated `RateResolutionT` object literal reads as
      the shape it returns; a builder would hide which branch decides what.
- [x] skipped · simplify · `editable-cell-input.tsx` · making `focus` required would force every
      mouse-only caller to opt out explicitly — the optional prop IS the two supported modes.
- [x] dropped · simplify · `build-import-plan.ts:190` · the twin `parsed.items.map` blocks feeding
      `sheetCoeffs` — every collapse tried came out longer than the two it replaced.
- [x] dropped · simplify · `round6` in `src/lib/utils/` rather than `src/lib/kosztorys/` · its sibling
      `round-to-cents.ts` is equally kosztorys-heavy and lives in utils; moving one of the pair is the
      scatter, not the fix.
- [x] dropped · simplify · `cell-select-menu.tsx` open-state union, the `sheet-import-dialog.tsx`
      ternary pair, the `formatCoeff`/`formatQty` shared body, the `conditionPlane` export narrowing —
      cosmetic, not worth the churn.
- [x] fixed (EX-707) · `settlement-rows.ts` · a red signal deferred to a „Problemy" diagnostic that did
      not exist. Owner ruled: add the row. `row-conditions.ts` now carries
      `work-without-planned-qty` — „Pokaż pozycje z wykonaną pracą bez przedmiaru (n)", revealing
      „Przedmiar", the cell that repairs it.
      test: TDD · unit — boundary case in `row-conditions.test.ts` (work entered AND no przedmiar).

## Simplify pass

Ran `/simplify` over the whole `staging`-relative diff — 4 cleanup agents (reuse / simplification /
efficiency / altitude) in parallel, then applied serially: **6 applied, 4 skipped, 5 dropped, 1 left
open**. Every one is folded into `## Findings` above tagged `simplify`; no separate report file.

## Tests & suite

- `pnpm typecheck` — clean.
- `pnpm test` — 2390 passed / 130 skipped (167 files). The skips are the DB-backed specs, which run
  under `pnpm test:integration` against the 5435 container.
- `pnpm build` — green (generate:importmap + generate:types + next build).
- `pnpm lint` — 3 errors, **all outside this diff and all pre-existing on `staging`**:
  `src/hooks/use-latest-request.ts:15` (React Compiler „Cannot access refs during render", last
  touched by `8e47fb80` on `staging`) and two `no-undef` on the stray root-level `test.js`. Not fixed
  here: neither file is in the branch's diff and the first is a behaviour-adjacent shared hook.
- `pnpm test:e2e` — **not run.** ~1h per run and it is never run unprompted; the browser-level
  obligations for this slice are the manual checks below.

## Archive status

**Blocked — not archivable.** Two reasons, both by design:

1. Three findings are still open `[ ]` (the `conditionCounts` inversion, the 7 module splits, the
   `divergenceFilterEngaged` rename). All three are real, all three are deliberately not fixed in this
   gate, and all three failed to file: the Linear workspace has hit its free-issue cap. They stay open
   until someone can file them.
2. The manual checks for fazy 5–7 in `context/foundation/manual-checks.md` are all unticked.
