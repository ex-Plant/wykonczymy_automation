# Consistent column sorting — Plan Brief

> Full plan: `context/changes/2026-08-17-sortowanie-kolumn-spojne/plan.md`

## What & Why

Sorting in the kosztorys grid is selective, and not by design: it hangs off one header helper
(`title()`), so any column rendered by a different header component silently ships without it. Five
column groups are affected — stage quantities, per-stage values (netto/brutto), „Komentarz", „Źródło
ceny wykonawcy" and „Mnożnik". The goal is the rule, not the five patches: every column carrying data
is sortable, and the only exceptions are the two columns with no data to compare.

## Starting Point

The sort engine (`row-view.ts`) is generic and complete — numeric/`pl`-collated comparison, `null`
sunk to the bottom in both directions, both sort scopes delegating to one comparator. What is
incomplete is the key resolver and the headers: `columnSortValue` is a static `switch` that cannot
express dynamic per-stage ids or per-plane fields, and two of the three header components
(`StageHeader`, `stageValueHeader`) know nothing about sorting.

## Desired End State

Opening any data column's header offers the same four sort commands plus „Zapisz kolejność" and
„Wyczyść sortowanie", and the resulting order matches the figures printed in the cells. `actions` and
the trailing gap stay unsortable because they hold nothing to compare.

## Key Decisions Made

| Decision                    | Choice                                                          | Why                                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the sort key lives    | Keep the central `columnSortValue`, add prefix-matched branches | One readable home for "how does this column sort"; the declarative alternative would touch every column factory and the `Column` type for a problem this size                                   |
| „Źródło ceny" ordering      | Explicit rank: auto → własny mnożnik → kwota stała              | Ascending runs from inherited to most hand-overridden, which is the only question anyone asks of that column; alphabetical would split the two override modes                                   |
| „Mnożnik" under kwota stała | `null` (sinks to bottom)                                        | Matches the „—" the cell renders and the rule `sortRows` already applies to every other dash-carrying column; `0` is a legal (catastrophic) multiplier and would mix those rows into real zeros |
| Stage value headers         | Get a full sort menu (new — they have none today)               | Required by the rule, and it is the most useful sort of the set when settling a crew's bill                                                                                                     |
| Completeness guard test     | Not built (owner call)                                          | It would only assert a key _exists_, never that it is correct, and it would cost a change to `columnSortValue`'s contract                                                                       |
| Test shape                  | Extend the existing EX-487 harness                              | Its fixture orders raw fields opposite to computed ones, so a green test cannot be an artefact of input order surviving                                                                         |

## Scope

**In scope:** sort keys for the five column groups; sort commands in `StageHeader`; a sort menu for
the per-stage value headers; removal of the now-dead `sortable` opt-out; unit specs per new key.

**Out of scope:** the sort engine and its scopes; filtering („Problemy" conditions); the completeness
guard test and the `columnSortValue` contract change it would need; `actions` / `layerGap`; the
degenerate „Sekcja" + „zachowując sekcje" identity sort; new columns, relabelling, picker/axis/layer
changes.

## Architecture / Approach

One central resolver taught two new shapes. **Dynamic per-stage ids** are matched by prefix and the
stage id parsed back out (new reverse parsers in `stage-keys.ts`, beside the builders they must agree
with). **Per-plane fields** resolve through `OVERRIDE_FIELDS` at the active view, which is what the
two subcontractor columns need and never had. Then the two sort-blind headers are brought up to
`SortHeader`'s behaviour — `StageHeader` gains sort items in the menu it already has, and the stage
value header composes `SortHeader` outright.

Two things fall out for free and need no work: `renderedFieldIds` is built from column ids, so a
deleted or filtered-out stage already clears its own sort; and „Zapisz kolejność" renumbers by
whatever key the active sort uses, so every new key is persistable on arrival.

## Phases at a Glance

| Phase                  | What it delivers                                                                                        | Key risk                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Sort keys           | Every keyless column resolves to the figure its cell shows                                              | Stage value keys must use the whole-view Σ etapów denominator — a narrowed one makes the order disagree with the printed amounts under a rabat |
| 2. Headers with a menu | „Komentarz" / „Źródło ceny" / „Mnożnik" turned on; stage headers gain sort commands; `sortable` deleted | The read-only branch of `StageHeader` must stay a bare label, or a client preview grows a menu                                                 |
| 3. Stage value headers | A sort menu where there was none                                                                        | Label wraps into a taller header row — the caret must not force a truncate at narrow widths                                                    |

**Prerequisites:** none — no schema, no migration, no new dependency.
**Estimated effort:** ~1 session; phase 1 is the bulk, phases 2–3 are wiring.

## Open Risks & Assumptions

- The shared-denominator rule is the one correctness trap: `totalQtyDone` is Σ of the view's stages,
  deliberately not the shown subset. A sort key computed off a narrowed list would look right until a
  rabat is applied.
- Reading the wrong plane for `priceCoeff` / `priceMode` would pass every test that exercises one
  plane only — hence the both-planes-order-oppositely assertion.
- Adding a menu to ~2×N stage value headers changes the look of a wide part of the header row; if it
  reads as noisy at many stages, that is a design call to make on sight, not a defect.

## Success Criteria (Summary)

- Every data column sorts from its header, both directions, both scopes.
- The sorted order agrees with the figures printed in the cells, rabat included.
- Sorting by a subcontractor column sorts by that plane's own numbers.
