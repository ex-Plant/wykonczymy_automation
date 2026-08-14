# Kosztorys filter conditions — Plan Brief

> Full plan: `context/changes/2026-08-14-kosztorys-filter-conditions/plan.md`
> Shaping & decisions: `context/changes/2026-08-14-kosztorys-filter-conditions/change.md`

## What & Why

The kosztorys editor's „Zwiń puste sekcje" is one number standing in for several unrelated
situations, so nobody can say what „pusta" means. This replaces it — and the hand-wired „Rozjazdy"
toggle beside it — with **one registry of named row conditions** driving every rule-based hiding in
the editor. Adding the next condition becomes one entry instead of a new toggle threaded through
three files.

## Starting Point

Three hiding mechanisms exist, each wired separately: text search, the „Rozjazdy" boolean, and the
section fold. „Pusta" means `roundToCents(section.net) === 0` — a figure that zeroes both when nothing
was executed and when nothing was priced. The second case is the damaging one: a section fully
executed but unpriced sums to zero, so today's button folds away exactly the section that needs
attention.

## Desired End State

One „Filtry" menu answers „czego nie widzę", with two parts over the same vocabulary — hide pozycje by
condition, fold sekcje by condition. Diagnostics (rozjazd, „bez ceny j.m.") sit in the toolbar as
counted buttons that vanish at zero. Conditions combine with AND, survive a refresh per investment,
and are impossible to forget about: numbers skip over hidden rows and section bands stay put with
their sums.

## Key Decisions Made

| Decision                     | Choice                            | Why                                                                                  | Source  |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| What „pusta" means           | Split into three named conditions | One figure was collapsing „nie wykonano" and „nie wyceniono" into one answer         | Shaping |
| Section rule                 | `∀` — every row matches           | A sum can reach zero by accident; „all of them" cannot                               | Shaping |
| „Bez ceny j.m." placement    | Diagnostic, not a fold            | It is a defect to find, not a state to hide                                          | Shaping |
| Rozjazd's home               | Folded into the same registry     | It already is a row predicate; two parallel systems would be the alternative         | Plan    |
| Empty section under a filter | Band survives with its sum        | Filtering rows silently hid whole sections — the opposite of the ask                 | Plan    |
| Position numbers             | Skip, like the sheet              | A renumbering ordinal makes the filter invisible and the number meaningless          | Plan    |
| Combining conditions         | AND, several at once              | The sheet's behaviour, and the only one that survives adding conditions              | Plan    |
| Persistence                  | `localStorage`, per investment    | Reuses `createJsonMapStore`; per-investment stops a filter travelling between budowy | Plan    |
| „Bez ceny" reads             | `clientPrice` always              | The only hand-typed price; subcontractor prices derive from it                       | Plan    |

## Scope

**In scope:** the condition registry; four conditions (bez przedmiaru, bez pomiaru z natury, bez ceny
j.m., rozjazd); per-investment persistence; stable ordinals; surviving section bands; the „Filtry"
menu; registry-driven diagnostic buttons.

**Out of scope:** sheet-style per-column filters (funnel, value picker, contains/range) — EX-665's
full scope, built on this registry later; named filter views; any change to how a figure is computed;
any server or database work.

## Architecture / Approach

`row-conditions.ts` holds the condition type and the four entries. Each declares its labels, whether
it lifts to a whole section, and whether it reads as a working filter or a diagnostic. Three
operations sit on top: match rows (AND), count over the full dataset, and lift to sections where every
row matches. The view pipeline becomes `filterRows` → `rowsMatchingConditions` → sort. Every surface —
menu, toolbar, fold — renders from the registry.

## Phases at a Glance

| Phase         | What it delivers                               | Key risk                                                                                                             |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. Registry   | Pure module + the four conditions, unit-tested | Getting the `∀` lift wrong on sections with no rows                                                                  |
| 2. State      | Active-condition set, persisted per investment | `createJsonMapStore` binds its key at module scope — the per-investment store needs a cache, not a render-time build |
| 3. Visibility | Stable ordinals, surviving bands               | Stable ordinals also change sorting's numbering — a visible change beyond filtering                                  |
| 4. UI         | „Filtry" menu + registry-driven diagnostics    | Two pilots in one menu must not read as one                                                                          |

**Prerequisites:** none — no migration, no new dependency, no prod step.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Stable ordinals change what sorting shows (scrambled-but-stable numbers instead of 1..n). Intended,
  and it matches the sheet, but it is the one change nobody explicitly asked for — flagged in the
  manual checks.
- Rozjazd's filter now persists across reloads, where today it resets. A consequence of folding it into
  the registry under the persistence decision.
- Section bands surviving an empty filter result applies to **search** too, not just conditions. Uniform
  by design; two behaviours for one visible thing would be worse.

## Success Criteria (Summary)

- A section fully executed but unpriced is no longer folded away as „pusta" — it is counted by a
  diagnostic instead.
- Any hidden pozycja is evident without opening a menu: numbers skip and the section band stays.
- Adding the next condition is one registry entry and no UI change.
