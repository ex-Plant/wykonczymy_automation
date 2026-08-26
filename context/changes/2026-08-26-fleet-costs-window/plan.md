# Per-vehicle date window on karta pojazdu + Opony column on /flota — Implementation Plan

## Overview

Two unrelated-in-code, related-in-intent asks from the owner:

1. **Karta pojazdu gets a date window.** Both tabs — Przeglądy and Koszty — narrow to a period the
   user picks on the card itself.
2. **`/flota` gets an „Opony" column.** The data is already there; only the column is missing.

## Current State Analysis

### The window

Everything the window needs already exists, and none of it is a query:

- `fetchVehicleDetail(id)` (`src/lib/queries/fleet.ts:60`) does **not** query per vehicle. It pulls
  `getFleetDataset()` — one `unstable_cache` entry holding every vehicle and every event — and filters
  it in memory (`events.filter((event) => event.vehicleId === id)`). A date window changes nothing
  about what is fetched.
- `VehicleDetailTabs` is `'use client'` and already receives `historyByType` **whole**. The full
  history is in the browser before the user touches anything.
- `isWithinRange` / `DateRangeT` (`src/lib/utils/date-range.ts`) already exist and compare `YYYY-MM-DD`
  lexically — no date parsing.
- `historyOfType` already normalises `performedAt` to a Warsaw day, so the entries handed to the client
  are already in the comparable form.
- `summariseCosts` (`src/lib/fleet/costs.ts:73`) takes `historyByType` and needs **no change** — hand it
  a narrower map and it summarises the narrower map.

### Why this is a client-side filter, not a server one

The plan initially threaded the window through `searchParams` → `parseDateRange` →
`fetchVehicleDetail`, mirroring `/flota`. That was wrong here, for three reasons:

1. **There is no per-vehicle query to narrow** (above). Server-side it is an in-memory `.filter()`; the
   only question is which machine runs it.
2. **The payload is already whole in the browser.** Client filtering costs zero extra bytes; server
   filtering would only shrink an already-small payload (a handful of przeglądy per car).
3. **The round-trip is not free.** `DateFilters` → `useUrlFilterParams` → `router.replace()` re-renders
   a dynamic route on every month pick: `requireAuth` runs, and `markSeen(payload, …, STREAMS.fleet)` —
   a **DB write** — runs with it. Each click on „Miesiąc" would fire a redundant notification-seen write
   to buy a filter the client can do instantly.

`vehicle-detail-tabs.tsx:17` already carries the same reasoning for the tab toggle: _"Local state, not
the URL: both views are computed from the same history the page already loaded, so switching costs
nothing and there is no server round trip worth linking to."_ The window is the same kind of thing.

**Owner's call, 2026-08-26:** the card does not need a URL. This reverses call #3 in `change.md`
(„same `?from=&to=` vocabulary as the listing") knowingly — see _What We're NOT Doing_.

### The Opony column

`tyres` is already on `VehicleRecordT`, already in the cached dataset (the `fleet-dataset-v4` key bump
covered it), already populated by the sheet import, and already rendered on karta pojazdu
(`flota/[id]/page.tsx:51`). Only the listing column is missing.

Naming: the TYRES _inspection_ deadline column is labelled „Wymiana opon"
(`INSPECTION_TYPE_LABELS.TYRES.pl`). The new column is „Opony" — the current set of tyres, matching the
card's row label. Close, deliberately distinct.

## Desired End State

On karta pojazdu, a date picker sits above the Przeglądy/Koszty toggle. Picking a period narrows both
tabs and the Koszty totals instantly, with no network traffic. The block above the tabs — terminy, „do
wymiany" marks, przebieg — is unaffected. An empty window says so in words distinct from „this car has
no history". On `/flota`, „Opony" shows next to the car and can be toggled off.

### Key Discoveries

- **The `kmSincePrevious` delta trap disappears entirely.** Server-side windowing would have had to
  filter _after_ computing deltas, or the oldest entry inside a window would lose its distance to a
  predecessor that exists just outside it. Filtering on the client is applied to entries whose deltas
  were already computed over the whole history, so the bug cannot occur.
- `DateFilters` is URL-bound by construction (`useUrlFilterParams` → `router.replace`), so the card
  cannot reuse it. Its _contents_ are all reusable primitives — `FilterGrid`, `FilterSelect`,
  `DateFilterButton`, `ClearButton`, `MONTHS`, `getMonthDateRange`.
- `DateFilters` has exactly two call sites (`fleet-data-table.tsx:31`, `transfer-filters.tsx:204`), both
  passing only `baseUrl`. Its public API can stay byte-identical through the extraction.

## What We're NOT Doing

- **No `?from=&to=` on the card.** Confirmed by the owner. The consequences are accepted: a filtered
  card is not a link you can send, and the window resets on refresh.
- **No `history.replaceState` variant.** It would keep the URL without the round-trip, but it forks how
  this codebase writes filter URLs — a second mechanism for a card nobody links to.
- **No change to `/flota`'s own window.** It stays server-side and URL-bound; it is already shipped and
  its `?from=&to=` is a link people do send.
- **No inheritance between the two.** Per owner's call #1: filtering the listing and clicking a car
  opens the card with an empty picker.
- **No narrowing of terminy / flagi / przebieg.** Per owner's call: a window is a lens on the past, not
  on what is due. Filtering to March must never let the card claim a przegląd expires never.
- **No cache-key bump.** The dataset payload shape is unchanged — only which subset renders.
- **No migration, no schema change, no new field.**

## Implementation Approach

Extract the picker, add one pure helper, wire the card, add the column. The extraction goes first so
the card has something to mount; the listing column is independent and lands last.

## Critical Implementation Details

- `narrowHistory` is a **pure function over the already-mapped entries**, not a re-derivation. It must
  not recompute `kmSincePrevious` — that is the whole reason the deltas survive the window.
- The empty-state copy branches on _whether a window is set_, not on whether the result is empty. „Brak
  wpisów" and „Brak wpisów w wybranym okresie" are different claims and a car with no history at all
  must keep the first one even while a window is active.
- `DateRangePicker` is **controlled** — `value: DateRangeT`, `onChange: (next: DateRangeT) => void`. It
  owns no state and knows nothing about URLs. `DateFilters` becomes the URL binding over it.

## Phase 1: Extract a controlled DateRangePicker

### Overview

Split `DateFilters` into a dumb controlled picker plus a thin URL adapter, so there is one picker with
two bindings rather than two pickers.

### Changes Required:

#### 1. `src/components/filters/date-range-picker.tsx` (new)

Controlled component holding everything `DateFilters` renders today — the `FilterGrid`, the Rok and
Miesiąc `FilterSelect`s, the Od/Do `DateFilterButton`s, the `ClearButton`. Props:

```ts
type DateRangePickerPropsT = {
  value: DateRangeT
  onChange: (next: DateRangeT) => void
  isPending?: boolean
}
```

The `pickerMonth` / `pickerYear` derivation, `handleMonthChange`, `handleYearChange` and the
`getMonthDateRange` call move here verbatim — they are presentation, not URL logic. The `Loader` stays
behind `isPending`, which a local-state caller simply omits.

#### 2. `src/components/filters/date-filters.tsx` (rewrite)

Becomes the URL binding: read `from`/`to` off `useSearchParams`, render `<DateRangePicker>`, and write
back through `updateMultipleParams`. Public API unchanged — still `{ baseUrl }`, so both existing call
sites are untouched.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm exec vitest run` — no spec covers these components today; the gate is the compiler plus the two
  untouched call sites

## Phase 2: The window on karta pojazdu

### Overview

Local state on the card, one pure helper, empty-state copy in both tabs.

### Changes Required:

#### 1. `src/lib/fleet/history-window.ts` (new)

```ts
export const narrowHistory = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
  range: DateRangeT,
): Record<InspectionTypeT, InspectionHistoryEntryT[]>
```

`byInspectionType` over `isWithinRange(entry.performedAt, range)`. `performedAt` is already a Warsaw
day by the time it reaches here. Returns the input untouched in shape — same keys, every type present.

#### 2. `src/components/fleet/vehicle-detail-tabs.tsx`

`useState<DateRangeT>({})`, `<DateRangePicker>` in its own row above the `ToggleGroup` (the bar is a
five-control grid; it will not share the toggle's row under 768px). Both tabs receive
`narrowHistory(historyByType, range)` and a `hasWindow` boolean.

The existing comment at the top of the file gains the window: it now explains why _both_ the toggle and
the window are local.

#### 3. `src/components/fleet/inspection-history.tsx` and `vehicle-costs.tsx`

Take `hasWindow: boolean`. Empty copy becomes „Brak wpisów w wybranym okresie" / „Brak przeglądów w
wybranym okresie" when it is set, existing copy otherwise.

Note `columnsFor(entries)` in `inspection-history.tsx` already derives its conditional columns from the
entries it is given, so a window that removes every INSURANCE entry correctly drops the insurer column
with it — no change needed.

#### 4. `src/__tests__/lib/fleet/history-window.test.ts` (new)

- narrows to the window, per type, leaving every key present
- an entry on the window's boundary day is included (both ends)
- **`kmSincePrevious` survives** — an entry whose predecessor falls outside the window keeps its delta
- an empty range (`{}`) returns everything

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/fleet/history-window.test.ts` passes
- `pnpm typecheck` passes

## Phase 3: Opony column on the fleet listing

### Overview

One accessor column, visible by default, hideable.

### Changes Required:

#### 1. `src/components/tables/fleet.tsx`

`columnHelper.accessor('tyres')` placed after `vehicle`, header „Opony", cell rendering the text or „—"
when empty. No `meta: { canHide: false }` — it participates in `ColumnToggle` like every other optional
column.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm exec vitest run src/__tests__/lib/fleet/` still passes

## Testing Strategy

### Unit Tests

`src/__tests__/lib/fleet/history-window.test.ts` — the four cases above. The delta-survival case is the
one carrying real risk: it is the bug the client-side approach avoids by construction, and a future
refactor that moves the narrowing back before the delta computation would reintroduce it silently.

### Integration Tests

None. No DB, no action, no query change.

### Manual Testing Steps

Registered once in `context/foundation/manual-checks.md` under a `## fleet-costs-window` section — not
duplicated into `## Progress`.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity + the owner's four calls: `context/changes/2026-08-26-fleet-costs-window/change.md`
- Why the card ignores the listing's window: EX-729
- The window-narrows-money-only rule, already documented: `src/lib/queries/fleet.ts:37-46`
- Unknown-cost semantics the Koszty tab inherits: `src/lib/fleet/costs.ts:27-42`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract a controlled DateRangePicker

#### Automated

- [x] 1.1 `pnpm typecheck` passes with `DateFilters` rebuilt over `DateRangePicker` — c6a56921
- [x] 1.2 Both existing call sites compile unchanged (`fleet-data-table.tsx`, `transfer-filters.tsx`) — c6a56921

### Phase 2: The window on karta pojazdu

#### Automated

- [x] 2.1 `history-window.test.ts` passes, incl. the `kmSincePrevious` survival case — 64f5cf5d
- [x] 2.2 `pnpm typecheck` passes with both tabs taking `hasWindow` — 64f5cf5d

### Phase 3: Opony column on the fleet listing

#### Automated

- [x] 3.1 `pnpm exec vitest run src/__tests__/lib/fleet/` still passes — PENDING_SHA
