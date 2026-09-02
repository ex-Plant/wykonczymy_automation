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

_Trimmed at archive (2026-09-02): 13 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 13 fixed, 6 other, 0 open._
