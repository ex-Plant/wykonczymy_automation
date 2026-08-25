# Review-gate ledger — import-zastepuje-w-calosci · 2026-08-19

Slice files (review scope — the parallel agents' files in the same commit range are excluded):

- `src/lib/kosztorys/sheet-import/item-key.ts`
- `src/lib/kosztorys/sheet-import/build-import-plan.ts`
- `src/lib/kosztorys/clean-description.ts`
- `src/lib/actions/kosztorys-import.ts`
- `src/lib/actions/kosztorys.ts` (`clearKosztorysAction` only)
- `src/components/kosztorys/editor/dialogs/clear-kosztorys-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/sheet-report-parts.tsx`
- `src/components/kosztorys/editor/dialogs/sheet-report-words.ts`
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`
- `src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts`
- `src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`
- `src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts`

Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure`, `module-cohesion-audit`,
`structure-scatter-audit`, `comment-noise-audit`. `/tailwind-v4-audit` dropped out — the slice adds no
new styling beyond one width utility.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `clear-kosztorys-dialog.tsx:51` · the copy promised a clean
      round trip („wrócisz do niego przez «Wczytaj»") right after announcing the rabat globalny is
      zeroed — but `SnapshotPayloadT` excludes the discount by design, so the restore cannot give it
      back. Now says „(przywrócenie stanu go nie cofa)", same wording as the szablon dialog.
      test: no automated test · unit — copy string, asserted nowhere; the E2E in EX-719 reads it.
- [x] 🟡 WARNING · fixed · code-review · `sheet-import-dialog.tsx:72` · `applyKosztorysImport` ran
      without a `catch`, so a transport rejection after a committed replacement left the grid showing
      rows that no longer exist, with no refresh. Copied the sibling `catch` from the clear dialog.
      test: no automated test · e2e — needs a failing transport mid-commit; folded into EX-719.
- [x] 🟡 WARNING · fixed · impl-review · `item-key.ts:23` · `fold()` trims, so folding the rule
      ` parc` → ` prac` lost its word boundary and „wyparcie" would have keyed as „wypracie",
      collapsing two unrelated prace. `foldRule` re-attaches the edge spaces.
      test: TDD · unit — `keeps a word-boundary rule from eating the middle of another word`.
- [x] 🟡 WARNING · fixed · impl-review · `build-import-plan.test.ts:320` · the „keeps a matched
      praca's wpisane etapy" spec was tautological — it passed on progress the _sheet_ supplies, not
      on anything carried over, so it would have stayed green under any behaviour. Replaced with the
      honest assertion (the arkusz's wykonanie wins over the app's) and named accordingly.
      test: TDD · unit — replaced in place.
- [x] 🔵 OBSERVATION · fixed · impl-review · `item-key.ts:26` · the convergence between
      `foldDescription` and `cleanDescription` rested on manual sampling. Now table-driven over every
      `TYPO_FIXES` entry, in normal and SHOUTED framing (46 rules × 2).
      test: TDD · unit — `keys „%s" the same before and after the cleaner rewrites it`.
- [x] 🔵 OBSERVATION · fixed · code-review · `kosztorys.ts:294` · `clearKosztorysAction` took a raw
      `investmentId` with no schema — the only mutation in the file that skipped `validateAction`.
      Added `clearKosztorysSchema`, and made `takeSettingsFromTree: false` explicit rather than
      relying on the option's absence.
      test: no automated test · unit — validation is the shared `validateAction` path, covered there.
- [x] fixed · module-cohesion · `item-key.ts:42` · `keyItems` was typed to `KosztorysItemT`, forcing
      `build-import-plan.ts` into a `as unknown as` cast for the half-built parsed rows. Generic over
      `{ sectionId, description }` — cast and its three-line apology gone.
- [x] fixed · structure-scatter · `build-import-plan.ts:182` · private `groupBy` re-implemented
      `@/lib/utils/group-in-order`. Deleted, call sites repointed.
- [x] fixed · feature-first · `sheet-report-words.ts` · `sectionNoun`/`itemNoun` lived in
      `preset-picker-groups.ts` and were imported by dialogs that have nothing to do with presets.
      Moved into the shared noun module; three import sites repointed.
- [x] fixed · module-cohesion · `sheet-report-parts.tsx:36` · `SHEET_SIDE`, `APP_SIDE` and
      `ReportCellT` were exported but consumed only in-file. Made module-private.
- [x] fixed · code-review · `clear-kosztorys-dialog.tsx:66` · confirm stayed enabled on an already
      empty rozpiska, whose only effect is an empty restore point in „Wersje". Now disabled.
      test: no automated test · e2e — folded into EX-719.
- [x] fixed · comment-noise · `sheet-import-dialog.tsx:218` · vanished-state clause („is what this
      block used to promise") trimmed; the rationale that survives the strip test kept.
- [x] fixed · UX (user) · `kosztorys-actions-menu.tsx:178` · „Wyczyść kosztorys…" moved from „Edycja"
      into the „Wersje" group, dropdown widened `w-64` → `w-80` so the description stops wrapping to
      three lines.
- [x] filed EX-717 · deferred · code-review · `build-import-plan.ts:147` · a matched praca loses its
      etap `label` / `plane` / `workerId` — fields the arkusz has no column for, so they are lost
      rather than replaced. Recoverable via „Wersje", hence not a blocker.
      **Rozstrzygnięte 2026-08-24 (właściciel): nie przenosimy — „zastąp" znaczy zastąp.** EX-717
      anulowane, test niepotrzebny; decyzja mieszka w
      `context/reference/kosztorys-editor-domain-notes.md` → „Decyzje zamknięte".
- [x] filed EX-718 · deferred · code-review · `replace-tree-with-snapshot.ts` · the „before" snapshot
      is read outside the write transaction, so a concurrent save in that window is snapshotted
      wrong. Single-owner app, so low-probability; fix belongs to that module, not this slice.
      test: TDD · integration — disposition recorded in EX-718.
- [x] filed EX-719 · deferred · slice-review-gate · browser-level E2E for the clear flow and the
      replacing import. Filed into the E2E backlog (`e2e-backlog`) rather than authored here.
- [x] dropped · simplify · `clear-kosztorys-dialog.tsx:25` · the item-count reduce is duplicated in
      `reload-from-preset-dialog.tsx:77`. A helper whose body equals the expression, for two call
      sites — not worth the module.
- [x] dismissed · impl-review · `item-key.ts:30` · plan prescribed `fold(cleanDescription(x))`;
      implementation folds the RULES instead. Verified as a correct deviation — `cleanDescription`
      fixes spelling before it un-shouts, so the prescribed form breaks on SHOUTED opisy. The
      table-driven spec above now pins the equivalence.
- [x] dismissed · code-review · `kosztorys.ts:310` · the empty tree's zeroed `settings` look like they
      would wipe VAT/współczynniki. They are inert: `takeSettingsFromTree` is off, so
      `restoreKosztorys` writes the investment's own settings back.

## Simplify pass

Ran the `/simplify` angles (reuse / simplification / efficiency / altitude) in-thread over the slice
diff rather than as a four-agent fan-out — the read-only gate fan-out had already covered the same
four angles on the same ~10 files, and its findings are the `simplify`/`module-cohesion`/
`structure-scatter` lines above (all applied). One new finding: the duplicated item-count reduce,
dropped as not worth a module. No separate report file — this ledger is the record.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run` (whole tree, end of Phase 4) — 2554 passed.
- Slice specs after the review fixes: `item-key.test.ts` (54) + `build-import-plan.test.ts` (22) —
  76 passed.
- `pnpm build` — clean.
- `pnpm lint` — 2 errors, both pre-existing and outside the slice (`src/hooks/use-latest-request.ts:15`,
  `test.js:255`, last touched by `8e47fb80`).
- `pnpm test:e2e` — not run (owner's standing rule: never unprompted). Coverage owed as EX-719.
- Full suite NOT re-run after the review fixes — pending the owner's go.

## Gate status

**In review, not done.** `context/foundation/manual-checks.md` § import-zastepuje-w-calosci has all
five boxes unticked, and Phase 5 (investment 90 back to 373 / 373 / 0, which now depends on the new
reset button) is the owner's manual step. Do not archive until those are ticked.
