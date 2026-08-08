# Let the kosztorys editor open empty — Plan Brief

> Full plan: `context/changes/2026-07-28-drop-empty-kosztorys-scaffold/plan.md`
> Change record: `context/changes/2026-07-28-drop-empty-kosztorys-scaffold/change.md`
> Linear: EX-615 (retires EX-463's stopgap)

## What & Why

An empty kosztorys currently cannot be opened — a non-dismissible dialog blocks the editor until a
first sekcja exists, and every preset-less new investment is auto-seeded with one. Both were EX-463
stopgaps for a cold-start dead end that no longer exists. This deletes the scaffold and lets the
editor open empty.

## Starting Point

EX-463 (Done 2026-07-17) justified the scaffold with _"no section means the toolbar's '＋ pozycja' is
hidden and there's no discoverable way in"_ — true on 2026-07-13, false since the `Dodaj` menu made
Sekcja / Sekcja z szablonu… / both Etap entries unconditional. Only „Praca" is section-gated, and it
is already correctly `disabled`. The zero-sekcja state is in fact already reachable in production:
`removeSectionAction` has no last-section guard, and the financial pipeline was probed against it —
all figures return `0`, all finite, nothing throws.

## Desired End State

An investment with no sekcje opens the normal editor — toolbar, empty grid, totals panel — with an
inert centred hint reading „Kosztorys jest pusty" / „Dodaj sekcję lub etap z menu „Dodaj" powyżej."
Adding a sekcja or an etap works in either order, and the hint clears the moment the first sekcja
lands, with no reload and no remount.

## Key Decisions Made

| Decision                                      | Choice                   | Why                                                                                                                                                     | Source   |
| --------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Default sekcja when adding an etap with none? | No fallback              | Etapy are investment-scoped with no section coupling anywhere in the chain; `buildNewSectionRow` reads live `stages` state, so etap-first works already | Analysis |
| Keep `createSectionWithFirstItem`?            | Keep                     | "A sekcja is never created alone" is a _rendering_ invariant (0-item sekcja emits 0 rows), separate from "a kosztorys must start with a sekcja"         | Analysis |
| „Wypełnij z szablonu" button                  | Delete                   | Its action refuses a populated kosztorys, so it was inherently empty-only; „Sekcja z szablonu…" in `Dodaj` covers it and is already ungated             | Analysis |
| `becamePopulated` remount clause              | Delete                   | Exists solely for the preset seed's missing `revision` bump; no live path once the button goes                                                          | Analysis |
| Empty-state affordance                        | Inert text, no buttons   | Smallest surface, nothing to keep in sync with the menu, teaches the affordance the user keeps using                                                    | Plan     |
| Emptiness signal                              | `subtotals.length === 0` | Full-dataset by construction — `gridRows` is never empty (synthetic rows) and `viewRows` empties on a no-hit search                                     | Plan     |
| New automated tests                           | None                     | Subtractive change; the risk is a dangling reference, which `pnpm typecheck` catches deterministically                                                  | Plan     |

## Scope

**In scope:** delete `EmptyKosztorysDialog` + its render, `SeedFromPresetButton`, the
`becamePopulated` clause, `seedBlankSectionAction`, `seedFromPresetAction`, the auto-seed branch in
`createInvestmentAction` + `SEED_BLANK_WARNING`, and the orphaned CR2 spec block; add the empty-grid
hint.

**Out of scope:** `createSectionWithFirstItem`, `seedInvestmentFromPreset`, a last-section guard on
`removeSectionAction`, action buttons in the empty state, and the `context/archive/` record of the
retired stopgap.

## Architecture / Approach

Three phases ordered so the app never sits half-wired: add the replacement affordance, then delete
the client scaffold it replaces, then delete the server surface that is by then unreachable. The hint
is an absolutely-positioned `EmptyState` overlay inside the existing `relative` grid wrapper — the
grid still renders beneath it, and the gate reads live editor state rather than the `tree` prop, so
the optimistic first-sekcja path clears it without a remount.

## Phases at a Glance

| Phase                         | What it delivers                                      | Key risk                                                     |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| 1. Empty-grid hint            | Inert `EmptyState` overlay on a sekcja-less kosztorys | Wrong emptiness signal showing the hint over a no-hit search |
| 2. Delete the client scaffold | Dialog, preset button, dead remount clause gone       | Restore-from-„Wersje" silently loses its remount trigger     |
| 3. Delete the server scaffold | Two actions, the auto-seed branch, orphaned spec gone | An orphaned import or caller surviving the deletion          |

**Prerequisites:** none — no schema change, no migration, no prod step.
**Estimated effort:** one session across the three phases.

## Open Risks & Assumptions

- The hint's copy names the `Dodaj` menu by label; renaming that menu later silently stales the
  sentence. Accepted as the cost of not duplicating the menu's actions inline.
- Investments already carrying an auto-seeded „Sekcja 1" are left as-is — a kosztorys with one sekcja
  stays a valid state, and per AGENTS.md kosztorys data is throwaway until dogfooding merges to
  `main`.
- E2E is deferred to the backlog (label `e2e-backlog`), not authored — see the plan's Testing
  Strategy for the scenario it must cover.

## Success Criteria (Summary)

- An empty kosztorys opens the editor with a hint instead of a blocking dialog.
- Etap and sekcja can be added in either order from `Dodaj`, and both persist.
- A preset-less new investment gets a genuinely empty kosztorys; a preset-backed one is unchanged.
