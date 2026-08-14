# Kosztorys filter conditions — one registry, two pilots

## Overview

The kosztorys editor hides rows three different ways today (search, the „Rozjazdy" toggle, the
section fold) and each was wired by hand. This change replaces the ad-hoc wiring with **one registry
of row conditions**: every condition declares its label, its predicate on a row, whether it lifts to a
whole section, and whether it reads as a working filter or as a diagnostic. The UI — a „Filtry" menu,
the toolbar's diagnostic buttons, the section fold — renders from that registry, so adding the next
condition is one entry, not a new toggle threaded through three files.

It also fixes the complaint that started this: „Zwiń puste sekcje" is one number
(`roundToCents(section.net) === 0`) standing in for several unrelated situations, so nobody can say
what „pusta" means.

## Current State Analysis

**Three hiding mechanisms, three shapes.**

- `filterRows(rows, query)` — `src/lib/kosztorys/row-view.ts:5`, text over description / sectionName / unit.
- `divergedRows(rows, stages)` — `row-view.ts:18`, the rozjazd predicate (`measureDiscrepancy(r, stages) != null`).
  Driven by a `useState` boolean (`use-kosztorys-editor.ts:191`) and a bespoke toolbar button
  (`kosztorys-editor-toolbar.tsx:51-64`) that hides itself at zero and carries a `CountBadge`.
- The section fold — `collapsedSectionIds` (a `Set<number>`), applied inside `buildSectionBandRows`,
  driven by `KosztorysSectionFilterMenu` through `FilterMultiSelect`'s single `extraAction` slot.

**The view pipeline** is `use-kosztorys-editor.ts:416-424`: `filterRows` → `divergedRows` → sort.
Adding a stage here is mechanical.

**Established invariants worth keeping.**

- **Sums never follow the filter.** `subtotals` / `totalNet` are computed over the full dataset
  (`use-kosztorys-editor.ts:432-434`, and the comment at `kosztorys-editor-body.tsx:98-99`). This
  matches the sheet, where `SUM` counts hidden rows and only `SUBTOTAL` skips them.
- **Counters are computed over the full dataset, never over what survived** — `divergedCount`
  (`use-kosztorys-editor.ts:428-431`); a count of the survivors would be a count of itself.
- **A filter suppresses the fold** — `foldSuppressed: search.trim() !== '' || divergedOnly`
  (`kosztorys-editor-body.tsx:139`), so a row is never hidden twice for two reasons.

**Two behaviours that must change, both discovered during planning.**

- **Ordinals renumber under a filter.** `ordinalByRowId.set(row.id, ordinalByRowId.size + 1)`
  (`section-band-rows.ts:66`) — they are positions in the surviving view, not identities. A filter is
  therefore invisible in the numbering.
- **A section whose rows all fail the filter emits no band at all** (`section-band-rows.ts:58-62`,
  and the comment there says so explicitly). So filtering rows already hides whole sections silently —
  the opposite of what this change is for.

**„Bez ceny j.m." is about `clientPrice`.** Subcontractor prices derive from it through the global
coefficients, with optional per-row overrides (`types.ts:50-54`), so the hand-typed gap is always in
`clientPrice`.

**Persistence primitives exist.** `createJsonMapStore` + `useJsonMap`
(`src/hooks/create-json-map-store.ts`) back the column widths and hidden columns — a sparse
`Record<string, V>` in `localStorage` with its own subscription, corrupt-value tolerance, and
updater-based writes. `usePriceView` (`use-price-view.ts:13`) is the per-investment keying precedent
(`kosztorys-view:${investmentId}`).

## Desired End State

One `row-conditions.ts` registry drives everything that hides a row by a rule:

- The **„Filtry" menu** (today's „Sekcje") has two parts — _ukryj pozycje wg warunku_ and _zwiń sekcje
  wg warunku_ — over the same condition vocabulary, plus the existing per-section list.
- The **toolbar** renders diagnostic conditions (rozjazd, „bez ceny j.m.") as counted buttons that
  disappear at zero — today's „Rozjazdy" button generalized, not special-cased.
- Active conditions **combine with AND**, survive a page refresh **per investment**, and are visible
  without opening a menu.
- A pozycja **keeps its number** whatever is filtered or sorted, so numbers skip rather than
  renumber.
- A **section band survives** even when every one of its rows was filtered out — it shows its name and
  its (full-dataset) sum.

Verify by: filtering to a condition that matches nothing in one section, and seeing that section's
band still present with its unchanged sum, its rows gone, and the surrounding ordinals skipping.

### Key Discoveries

- `divergedRows` is already exactly a registry entry's predicate (`row-view.ts:18`) — folding it in is
  the proof the registry works, and avoids two parallel condition systems.
- `FilterMultiSelect`'s `extraAction` is singular (`filter-multi-select.tsx:40`) but has **one call
  site** — the kosztorys menu itself. Generalizing it to plural is a one-call-site change.
- `emptySectionIds` (`settlement-aggregates.ts:150-152`) has a spec test asserting the old rule:
  `src/__tests__/lib/kosztorys/kosztorys-empty-sections.test.ts`.
- `createJsonMapStore` takes its storage key at **module scope**. A per-investment key needs a
  keyed cache of stores, not a store built during render.

## What We're NOT Doing

- **No column filters in the sheet's sense** — no funnel in the header, no value-picker, no
  contains / greater-than / between. EX-665's full scope builds on this registry as a second helping.
- **No named filter views** (the sheet's „widoki filtrów").
- **No change to how any figure is computed.** Sums, subtotals and the totals bar stay full-dataset.
- **No new condition beyond the four named below** — the point is the registry, not the catalogue.
- **No server or database work.** This is entirely view state.

## Implementation Approach

Build the pure registry first and prove it with unit tests, then move state onto it, then make the
filter visible, then rebuild the UI on top. Each phase leaves the editor working: after Phase 2 the
behaviour is what it is today plus persistence; the visible changes land in 3 and 4.

The registry entry is the whole design:

- `id` — stable, it is the localStorage key
- `label` — how the condition reads when hiding **pozycje**
- `sectionLabel` — how it reads when folding **sekcje**; `null` means it does not lift
- `kind` — `'filter'` (a working narrowing, lives in the menu) or `'diagnostic'` (a defect, lives in
  the toolbar with a count, hidden at zero)
- `matches(row, ctx)` — the predicate; `ctx` carries `stages`, which the pomiar and rozjazd
  predicates need

The four entries:

| id                 | label                     | lifts to section | kind       |
| ------------------ | ------------------------- | ---------------- | ---------- |
| `no-planned-qty`   | bez przedmiaru            | ✓                | filter     |
| `no-measured-qty`  | bez pomiaru z natury      | ✓                | filter     |
| `no-client-price`  | bez ceny j.m.             | ✗                | diagnostic |
| `measure-diverged` | rozjazd pomiaru z arkusza | ✗                | diagnostic |

## Critical Implementation Details

**Ordinals become identities, and that changes sorting too.** Making a number skip under a filter
means computing it from the row's rank in the base dataset rather than its position on screen. The
same rule then applies under a sort: a sorted view shows scrambled-but-stable numbers instead of
1..n. That is the sheet's behaviour and it is what makes the number worth saying out loud to a crew,
but it **is** a visible change beyond filtering — it belongs in the manual checks.

**Rozjazd's persistence changes as a side effect.** It is a `useState` today, so it resets on reload;
as a registry member it persists like the rest. This is the decided behaviour, not an oversight.

**The section fold stays a one-shot action, not a live condition.** „Zwiń sekcje bez wykonanych prac"
computes the set once and writes it into `collapsedSectionIds`, exactly like today's extraAction —
so the tick marks in the section list stay the only description of what is folded, and the picker
cannot disagree with the grid.

---

## Phase 1: The condition registry

### Overview

A pure module holding the condition type, the four entries, and the two operations over them —
matching rows, and lifting a condition to whole sections. No React, no storage.

### Changes Required

#### 1. The registry

**File**: `src/lib/kosztorys/row-conditions.ts` (new)

**Intent**: Define what a condition is and enumerate the four. Give callers one way to apply a set of
active condition ids to rows (AND), one way to count a single condition over the full dataset, and one
way to lift a liftable condition to the set of sections where **every** row matches.

**Contract**: `RowConditionT` = `{ id, label, sectionLabel: string | null, kind: 'filter' | 'diagnostic',
matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean }`, with
`RowConditionCtxT = { stages: KosztorysStageT[] }`. Exports `ROW_CONDITIONS` (ordered, the display
order), `rowsMatchingConditions(rows, activeIds, ctx)` (AND; an empty/unknown id set returns `rows`
untouched), `countMatching(rows, conditionId, ctx)`, and
`sectionIdsWhereAllMatch(rows, conditionId, ctx)`. The `∀` lift returns only sections that actually
have rows — a section with no rows cannot vacuously qualify.

Predicates: `no-planned-qty` → `!(row.plannedQty > 0)`; `no-measured-qty` → the row's Σ etapów is not

> 0; `no-client-price` → `!(row.clientPrice > 0)`; `measure-diverged` → today's
> `measureDiscrepancy(row, stages) != null`.

#### 2. Retire the bespoke rozjazd helper

**File**: `src/lib/kosztorys/row-view.ts`

**Intent**: `divergedRows` becomes the `measure-diverged` entry's predicate; delete the standalone
export once nothing imports it. `filterRows` and the sort helpers stay where they are — text search
is not a registry condition (it takes an argument).

**Contract**: Removal is gated on `pnpm typecheck`, not on grep.

#### 3. The `∀` rule replaces the net-is-zero rule

**File**: `src/lib/kosztorys/settlement-aggregates.ts`

**Intent**: Delete `emptySectionIds`. The section fold now asks a named condition through
`sectionIdsWhereAllMatch`, so the section subtotal no longer needs to answer „is this section empty".

**Contract**: `emptySectionIds` is removed along with its import in `use-kosztorys-editor.ts:50`;
`src/__tests__/lib/kosztorys/kosztorys-empty-sections.test.ts` is rewritten against the new rule (see
Testing Strategy).

### Success Criteria

#### Automated Verification

- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- Rewritten section spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-empty-sections.test.ts`

#### Manual Verification

- (none — this phase ships no UI)

---

## Phase 2: Active-condition state, persisted per investment

### Overview

Replace the `divergedOnly` boolean with a set of active condition ids, persisted in `localStorage`
under a per-investment key, and run it through the existing view pipeline.

### Changes Required

#### 1. The persistence hook

**File**: `src/components/kosztorys/editor/hooks/use-active-conditions.ts` (new)

**Intent**: Hold the active condition ids as a sparse `{ [conditionId]: true }` map on
`createJsonMapStore`, keyed per investment, and expose read/toggle/clear.

**Contract**: `useActiveConditions(investmentId): { activeIds: Set<string>, toggle(id): void, clear(): void }`,
storage key `kosztorys-filters:${investmentId}` (mirrors `usePriceView`'s per-investment keying).

Because `createJsonMapStore` binds its key at module scope, the per-investment store must come from a
module-level `Map<string, JsonMapStoreT<boolean>>` cache — one store per key, created on first use.
Building a store during render would hand `useSyncExternalStore` a new `subscribe` every render.

Unknown ids read out of storage are ignored at use, not deleted — a condition removed and later
restored keeps working, and a stale key cannot hide rows for a condition that no longer exists.

#### 2. Wire it into the editor hook

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Drop `divergedOnly` / `setDivergedOnly` / `divergedCount`. Apply the active conditions in
the view pipeline after the text search, and expose per-condition counts computed over the full
dataset.

**Contract**: The pipeline at `:416-424` becomes `filterRows` → `rowsMatchingConditions` → sort. The
preview gate that currently zeroes rozjazd (`divergedOnlyActive` at `:192`, `divergedCount` at `:429`)
now suppresses **all** conditions — the client's document carries none of this. Context exposes
`activeConditionIds`, `toggleCondition`, `clearConditions`, `conditionCounts: Map<string, number>`
(full-dataset, per the counter invariant) and `hiddenRowCount`.

#### 3. Keep the fold suppression honest

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: `foldSuppressed` must fire for any active condition, not just rozjazd.

**Contract**: `foldSuppressed: search.trim() !== '' || activeConditionIds.size > 0`.

### Success Criteria

#### Automated Verification

- Editor-hook and body specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys`
- Row-view spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts`

#### Manual Verification

- „Rozjazdy" still filters exactly as before when it is the only active condition
- A filter set before a page refresh is still active after it
- Opening a different investment's kosztorys does not carry the previous one's filter

---

## Phase 3: Make the filter visible — stable numbers, surviving bands

### Overview

Two changes in `section-band-rows.ts` that together stop a filter from being invisible: a pozycja
keeps its number, and a section keeps its band.

### Changes Required

#### 1. Ordinals come from the base dataset

**File**: `src/lib/kosztorys/section-band-rows.ts`

**Intent**: A pozycja's number is its rank among all item rows in display order, not its position in
the filtered view — so filtering makes numbers skip, and sorting scrambles them rather than
renumbering.

**Contract**: `buildSectionBandRows` takes the ordinal map as an input instead of building it
(`ordinalByRowId` currently assigned at `:31` and `:66`), computed once by the caller over the
unfiltered, unsorted rows. Both branches — banded and unbanded — read the same map.

#### 2. A section keeps its band when all its rows are filtered out

**File**: `src/lib/kosztorys/section-band-rows.ts`

**Intent**: Emit a band for every section present in the base dataset, in display order, not only for
sections with a surviving row. The band shows the section's name and its full-dataset sum; a section
with no surviving rows renders header and footer with nothing between.

**Contract**: `OptsT` gains the ordered section list (id + a representative row for name/colour) so
the builder can emit bands for sections the filtered rows never mention. The existing rule that a
collapsed section shows its header alone (`:49-53`) is unchanged. This applies uniformly to search and
to conditions — one visible behaviour, not two.

### Success Criteria

#### Automated Verification

- Band spec passes, extended for both rules: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-band-rows.test.ts`

#### Manual Verification

- Filtering to a condition matching nothing in one section leaves that section's band and sum on
  screen, with no rows under it
- Position numbers skip over filtered-out rows instead of renumbering
- Sorting by a column no longer renumbers positions 1..n — numbers travel with their rows
- Searching behaves the same way as a condition filter with respect to bands

---

## Phase 4: The „Filtry" menu and the diagnostic buttons

### Overview

Rebuild today's „Sekcje" menu into one „Filtry" menu with two parts over the same vocabulary, and
render the toolbar's diagnostics from the registry instead of hand-writing one button.

### Changes Required

#### 1. Plural extra actions

**File**: `src/components/transfers/filter-multi-select.tsx`

**Intent**: The section list needs one fold shortcut per liftable condition, not one.

**Contract**: `extraAction?: { label, select }` → `extraActions?: Array<{ label, select }>`, rendered as
one `CommandItem` each in the existing slot. One call site to update.

#### 2. The menu

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx`
(replaces `kosztorys-section-filter-menu.tsx`)

**Intent**: One menu answering „czego nie widzę": a _ukryj pozycje_ part listing every `kind: 'filter'`
condition as a toggle with its count, and the existing section list whose fold shortcuts are now one
per liftable condition, each labelled by its `sectionLabel` and carrying the count of sections it
would fold.

**Contract**: Trigger label „Filtry", showing the number of active conditions when there are any. The
fold shortcuts stay one-shot writes into `collapsedSectionIds` via
`sectionIdsWhereAllMatch` — no live condition on the fold. The section-list semantics
(`FILTER_NONE`, complement-of-ticked → collapsed) are unchanged.

#### 3. Diagnostics render from the registry

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`

**Intent**: Replace the hand-written „Rozjazdy" button with a map over the registry's
`kind: 'diagnostic'` entries, each keeping today's behaviour: pressed state, `CountBadge`, absent (not
disabled) at zero.

**Contract**: The existing button markup at `:51-64` becomes the loop body; the count comes from
`conditionCounts`. „Bez ceny j.m." appears next to „Rozjazdy" with no further wiring — the proof the
registry is extensible.

#### 4. The empty state names what is filtering

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: The „Brak rozjazdów" empty state (`:253-259`) must speak for whichever conditions are
active, and stay the goal-state message it is today rather than reading as a dead end.

**Contract**: Title derived from the active conditions' labels; the single-condition case must still
read as naturally as „Brak rozjazdów" does.

### Success Criteria

#### Automated Verification

- Menu/toolbar specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys`

#### Manual Verification

- „Filtry" shows both parts, and the section-fold shortcuts fold exactly the sections where every
  pozycja matches
- Two conditions active at once narrow to their intersection
- „Bez ceny j.m." appears in the toolbar with a count, and disappears once every pozycja is priced
- A kosztorys with everything priced and no rozjazd shows no diagnostic buttons at all
- The trigger shows how many conditions are active without opening the menu

---

## Testing Strategy

### Unit tests

- `src/__tests__/lib/kosztorys/row-conditions.test.ts` (new) — each predicate on its boundary
  (`0` vs `null` vs a positive), the `∀` lift (a section with one non-matching row does not qualify; a
  section with no rows never qualifies), and AND combination (two conditions narrow to the
  intersection; an empty active set is a no-op; an unknown id is ignored rather than matching nothing).
- `src/__tests__/lib/kosztorys/kosztorys-empty-sections.test.ts` (rewritten) — the case that motivated
  the change: a section fully executed but with no `clientPrice` sums to zero, so the old rule called
  it „pusta"; under the new rule it is **not** folded by „bez pomiaru z natury", and is instead counted
  by the „bez ceny j.m." diagnostic.
- `src/__tests__/lib/kosztorys/section-band-rows.test.ts` (extended) — a section whose every row is
  filtered out still emits header and footer; ordinals skip a filtered row and survive a sort.

### Integration tests

None. This change touches no server action, no database, no cache — the DB-backed integration gate has
nothing to exercise here.

### Manual testing steps

1. Seed a kosztorys (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`), open the
   editor, and zero a whole section's `Cena j.m.` while leaving its etapy filled.
2. Confirm the section is **not** offered as foldable by „bez pomiaru z natury", and that „bez ceny j.m."
   appears in the toolbar counting those rows.
3. Turn on „bez przedmiaru", note which ordinals disappear, and confirm the remaining numbers skip.
4. Add „bez pomiaru z natury" on top and confirm the result is the intersection.
5. Refresh; confirm both conditions are still on. Open another investment's kosztorys; confirm it is
   unfiltered.
6. Sort by „Wartość netto" and confirm numbers travel with their rows.

## Performance Considerations

The dataset is a client-side array that can reach 1000+ rows. Conditions run once per active
condition per `viewRows` recompute, and the counts run once per registry entry over the full dataset —
both linear, both inside existing `useMemo` boundaries. The counts are the only new full-dataset pass;
they replace `divergedCount`'s identical pass, so the added cost is one linear scan per extra
condition. No memoization beyond what the React Compiler already handles.

## Migration Notes

No data migration — this is view state. Users with a `kosztorys-v2-*` layout in `localStorage` are
unaffected; the new key is separate and its absence is the unfiltered default.

## Whole-tree Gate

Run once, after Phase 4.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Shaping and decisions: `context/changes/2026-08-14-kosztorys-filter-conditions/change.md`
- Linear: EX-665
- The rozjazd filter this generalizes: `context/changes/2026-08-13-pomiar-bez-etapu/`
- Persistence primitive: `src/hooks/create-json-map-store.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The condition registry

#### Automated

- [ ] 1.1 New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- [ ] 1.2 Rewritten section spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-empty-sections.test.ts`

### Phase 2: Active-condition state, persisted per investment

#### Automated

- [ ] 2.1 Editor-hook and body specs still pass: `pnpm exec vitest run src/__tests__/components/kosztorys`
- [ ] 2.2 Row-view spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts`

### Phase 3: Make the filter visible — stable numbers, surviving bands

#### Automated

- [ ] 3.1 Band spec passes, extended for both rules: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-band-rows.test.ts`

### Phase 4: The „Filtry" menu and the diagnostic buttons

#### Automated

- [ ] 4.1 Menu/toolbar specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys`
