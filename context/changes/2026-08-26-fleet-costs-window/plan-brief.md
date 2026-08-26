# Per-vehicle date window on karta pojazdu + Opony column on /flota — Plan Brief

> Full plan: `context/changes/2026-08-26-fleet-costs-window/plan.md`

## What & Why

Two owner asks. **(1)** Koszty and Przeglądy on karta pojazdu can only be read whole — there is no way
to ask „ile ten samochód kosztował w lipcu". **(2)** The `/flota` listing has no „Opony" column, though
the data is already imported and already shown on the card.

## Starting Point

`fetchVehicleDetail` does not query per vehicle — it pulls one cached dataset covering the whole fleet
and filters it in memory. `VehicleDetailTabs` is a client component that already receives the vehicle's
full history. `isWithinRange` / `DateRangeT` already exist. `tyres` is already on the row type, in the
cached dataset, and rendered on the card.

## Desired End State

A date picker above the Przeglądy/Koszty toggle narrows both tabs and the Koszty totals instantly, with
no network traffic. Terminy, „do wymiany" and przebieg are untouched by it. An empty window says so in
words distinct from „this car has no history". „Opony" shows on the listing next to the car, hideable.

## Key Decisions Made

| Decision                  | Choice                                       | Why                                                                                                                        |
| ------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Where filtering runs      | **Client**, on data already in the browser   | There is no per-vehicle query to narrow; the payload is already whole; the round-trip costs a `markSeen` DB write per pick |
| Window state              | Local `useState`, **no URL**                 | Owner: the card does not need a shareable link. Same reasoning the tab toggle already carries                              |
| URL without round-trip    | Rejected (`history.replaceState`)            | Forks how the codebase writes filter URLs, for a card nobody links to                                                      |
| Picker reuse              | Extract controlled `DateRangePicker`         | `DateFilters` is URL-bound; one picker with two bindings beats two pickers                                                 |
| Inheritance from `/flota` | None — card opens unfiltered                 | Owner's call #1; keeps EX-729 intact in spirit                                                                             |
| Scope of the window       | The two tabs only                            | A window is a lens on the past, not on what is due — narrowing terminy would let the card lie                              |
| Empty-state copy          | Branches on _window set_, not _result empty_ | „no history" and „filtered out of view" are different claims                                                               |
| Opony column              | Visible by default, hideable, „—" when empty | Asked for because it is read off the sheet; should not need discovering                                                    |

## Scope

**In scope:** the controlled `DateRangePicker` extraction (+ `DateFilters` as its URL adapter); a pure
`narrowHistory` helper and its spec; local window state and the picker on karta pojazdu; empty-state
copy in both tabs; the „Opony" accessor column on `/flota`.

**Out of scope:** any change to `/flota`'s own server-side window; `?from=&to=` on the card; migrations,
schema, new fields; a cache-key bump (the payload shape is unchanged).

## Phases

1. **Extract a controlled `DateRangePicker`** — `DateFilters` becomes a thin URL binding over it; both
   its call sites stay byte-identical.
2. **The window on karta pojazdu** — `narrowHistory` + local state + picker above the toggle + empty
   copy in both tabs. Spec includes the `kmSincePrevious`-survives case.
3. **Opony column** — one accessor in `getFleetColumns()`.

## Risks

- **Low.** No data, no schema, no query change, no cache key. The one thing to keep honest is that
  `narrowHistory` filters _already-mapped_ entries — moving the narrowing before the delta computation
  would silently strip `kmSincePrevious` from every entry at a window's edge. That is what its spec
  guards.
