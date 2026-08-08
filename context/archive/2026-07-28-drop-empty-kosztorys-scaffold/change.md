---
change_id: drop-empty-kosztorys-scaffold
title: Let the kosztorys editor open empty — retire the forced-first-section scaffold
status: archived
created: 2026-07-28
updated: 2026-07-28
archived_at: 2026-07-28T13:29:56Z
branch: staging
worktree: null
---

## Notes

Drop the empty-kosztorys scaffold: let the editor open empty. Delete `EmptyKosztorysDialog` + its
render, `seedBlankSectionAction` + its idempotency guard, the EX-463 auto-seed branch in
`createInvestmentAction` + `SEED_BLANK_WARNING`, `SeedFromPresetButton` + `seedFromPresetAction`, and
the now-dead `becamePopulated` clause in `use-restore-remount`. Keep `createSectionWithFirstItem` —
"a sekcja is never created alone" is a _rendering_ invariant (a 0-item sekcja emits 0 rows), entirely
separate from "a kosztorys must start with a sekcja". Add a lightweight inline hint in the empty grid
body pointing at the `Dodaj` menu.

Retires EX-463's stopgap, whose premise went stale. EX-463 (Done 2026-07-17) justified the scaffold
with _"no section means the toolbar's '＋ pozycja' is hidden and there's no discoverable way in"_ —
true on 2026-07-13, false since the `Dodaj` menu made Sekcja / Sekcja z szablonu… / both Etap entries
unconditional. Only „Praca" is section-gated, and it is already correctly `disabled`.

### Analysis findings (2026-07-28, pre-plan)

- **Etapy do not need a sekcja.** `kosztorys-stages` has no section relation (investment + ordinal +
  label + plane); `addStageAction(investmentId, plane)` is investment-scoped; `handleAddStage` sets
  its own `stages` state and its `patchRows` is a harmless no-op at zero rows. `buildNewSectionRow`
  reads that live `stages` state, so etap-then-sekcja and sekcja-then-etap both carry the
  `stage_<id>` keys. **No default-sekcja fallback is needed.**
- **The zero-sekcja state is already reachable in production** — `removeSectionAction` has no
  last-section guard. The server pipeline was probed against it: `doneNet` / `sumaPracNet` /
  `rabatClientNet` / `globalRabatNet` all return `0`, all finite, nothing throws.
- **`becamePopulated` is collateral, not a risk.** It only fires when `restorePending` is armed, and
  only `handleRestored` arms it. It exists _solely_ because the whole-tree preset seed doesn't bump
  `investment.updatedAt`; with `SeedFromPresetButton` gone that clause has no live path. Both
  first-sekcja routes (`handleAddSection`, `handleAppendedSections`) append optimistically to `rows`
  and already work from zero rows without a remount.
- **„Wypełnij z szablonu" is redundant, not lost.** `seedInvestmentFromPreset` returns `'not-empty'`
  on a populated kosztorys, so the button was inherently empty-only; „Sekcja z szablonu…" in the
  `Dodaj` menu yields the same outcome on an empty kosztorys and is already ungated.
  `seedInvestmentFromPreset` itself stays — `createInvestmentAction` still uses it for the
  preset-chosen-at-create path.

### Owed

- `src/__tests__/lib/actions/kosztorys-create-order.test.ts` — the CR2 `seedBlankSectionAction`
  idempotency block goes with the action.
- `src/__tests__/lib/kosztorys/display-order.test.ts:195` — a comment references
  `EmptyKosztorysDialog`; update it.
- `context/archive/2026-07-11-kosztorys-editor-ux/` documents the stopgap — leave the archive alone,
  but check whether a living doc repeats the stale premise.

## Kept from the plan (deleted 2026-08-08)

- **The emptiness signal is `subtotals.length === 0`, and the choice is load-bearing.** Never
  `gridRows` (always ≥ 2 synthetic rows, so it is never empty) and never `viewRows` / `bodyRows` — a
  no-hit search empties those, which would put „Kosztorys jest pusty" over a populated kosztorys.
  `subtotals` is full-dataset by construction.
- **The gate reads live editor state, not the `tree` prop.** The first sekcja arrives through the
  optimistic path with no new `tree`, so a `tree`-derived gate leaves the hint stuck over a grid that
  already has a row.
- **The share layout (`clientView`) gets the title only, no description** — it renders no toolbar and
  no `Dodaj` menu, so it must not be told to use one.
- **The empty state is inert text, not buttons**: smallest surface, nothing to keep in sync with the
  `Dodaj` menu, and it teaches the affordance the user will keep using. Accepted cost — the copy names
  the `Dodaj` menu by label, so renaming that menu silently stales the sentence.
- **No new automated tests**: subtractive change whose only real risk is a dangling reference, which
  `pnpm typecheck` catches deterministically.
