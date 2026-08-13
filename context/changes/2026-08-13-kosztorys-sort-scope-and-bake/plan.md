# Zakres sortowania + utrwalanie kolejności całego kosztorysu — Implementation Plan

## Overview

Sorting in the kosztorys editor currently has exactly one behaviour: within sections. EX-682 replaced
the old flat sort with `sortRowsWithinSections` outright, because a flat sort scatters a section's rows
and the section bands presume contiguity. This change brings the flat sort back as a **named, chosen
scope** rather than the only behaviour, and adds a whole-kosztorys variant of the „Utrwal kolejność"
write so one click can bake every section at once.

Both sorts stay lenses. Nothing about a sort is persisted, in the browser or the database. The only
durable ordering remains `display_order`, written exclusively by an explicit „Utrwal kolejność".

## Current State Analysis

- **Sort state** is `V2SortStateT = { field: string; dir: SortDirT } | null`
  (`src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts:11`). It is set in one place
  (`setSortField`, `src/components/kosztorys/editor/use-kosztorys-editor.ts:322`) and read in one
  (`viewRows`, `use-kosztorys-editor.ts:413`).
- **`SortHeader`** (`src/components/kosztorys/editor/grid/sort-header.tsx`) renders three items —
  rosnąco / malejąco / wyczyść — and calls `onSort(dir | null)`. It knows nothing about sections.
- **Both sort functions already exist.** `sortRows` (`src/lib/kosztorys/row-view.ts:34`) is the flat
  sort; `sortRowsWithinSections` (`row-view.ts:62`) groups by `sectionId` and delegates to it per
  group. Restoring the global scope needs no new sorting code.
- **`buildSectionBandRows`** (`src/lib/kosztorys/section-band-rows.ts`) takes
  `{ collapsedSectionIds, foldSuppressed }`. Its `enabled` kill-switch was removed in EX-682 once
  sorting stopped scattering sections — a global sort scatters them again, so the switch has to come
  back, keyed on the scope rather than on "any sort".
- **`reconcileSort`** (`src/lib/kosztorys/sort-value.ts:70`) is generic over `SortT extends
{ field: string }`, so widening the sort type flows through untouched.
- **The bake path** is `handlePersistSectionOrder` → `planSectionRenumber`
  (`src/lib/kosztorys/display-order-plan.ts`) → `renumberItemOrderAction`
  (`src/lib/actions/kosztorys.ts`) → `renumberDisplayOrder` (`src/lib/kosztorys/display-order.ts`).
  The action is section-scoped by a guard that counts how many of the submitted ids carry
  `section_id = $1` and refuses the whole write on a mismatch.
- **`kosztorys_items` carries `investment_id` directly** (`src/lib/db/kosztorys-tree.ts:77`), so the
  whole-kosztorys guard is the same shape as the section one with a different column.
- **The row menu already labels groups by scope** — „Praca" and „Sekcja" carry the same four move
  commands and the label is the only thing saying which one moves
  (`src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx:121`).

## Desired End State

Opening a column's header menu offers four sort commands whose scope is spelled out in the label, plus
clear. Choosing a within-sections sort reorders rows inside each section with the bands intact;
choosing a whole-kosztorys sort produces one flat ordered list with no bands. Neither writes anything.

The row menu's „Sekcja" group still carries „Utrwal kolejność"; a new „Kosztorys" group carries
„Utrwal kolejność w całym kosztorysie", which renumbers every section in one write and undoes in one
step. Under a whole-kosztorys sort both bake commands are disabled and say why.

Verify: sort by „Opis" w sekcjach → bands visible, sections in their own order. Switch to w całym
kosztorysie → bands gone, one alphabetical list, both „Utrwal" items greyed. Back to w sekcjach →
„Utrwal kolejność w całym kosztorysie" → clear the sort → reload → order held in every section.

### Key Discoveries:

- `sortRows` was never deleted — global sort is a call-site choice, not new code (`row-view.ts:34`).
- `buildSectionBandRows`'s removed `enabled` flag is exactly the switch a global sort needs back
  (`section-band-rows.ts`); its deleted test comes back with it.
- `planSectionRenumber` takes a row set and a `sectionId`; a whole-kosztorys plan is that function run
  per section with the refs concatenated — the section boundary is preserved because each section is
  renumbered 0…n-1 independently (`display-order-plan.ts:11`).
- `renumberDisplayOrder` takes an arbitrary id→index list and writes it in one statement with the
  `ORDER BY id FOR UPDATE` lock discipline from EX-632 — it already carries a whole-kosztorys write
  without modification (`display-order.ts`).

## What We're NOT Doing

- **Not persisting any sort state** — not in localStorage, not in the database. A stored sort rule is
  a live second authority over order: after ▲▼ and a reload the rule re-sorts the row back and the
  move silently evaporates. We store the result (`display_order`), never the rule.
- **Not making a within-sections sort auto-write.** The stored order can be a deliberate arrangement
  the owner set as the default; a glance at „Pozostało" must not overwrite it. The write stays an
  explicit command (owner, 2026-08-13).
- **Not persisting a global sort at all** — its order interleaves sections, and `display_order` only
  expresses position within a section, so baking it would mean re-filing prace under other sections.
- **Not touching** the section-scoped „Utrwal kolejność" from EX-683; it stays as shipped.
- **Not changing** what ▲▼ / „Wstaw" do — they remain disabled under any active sort, either scope.

## Implementation Approach

Three phases, each independently verifiable. Phase 1 is view-layer only and lands the scope choice.
Phase 2 lands the server write for the whole-kosztorys bake behind a DB spec, with no UI reaching it
yet. Phase 3 wires the menu, the undo entry, and the scope-dependent disabling.

The sort scope rides in the sort state itself (`{ field, dir, scope }`) rather than as a separate
editor-level toggle: it is a property of the active sort, so a cleared sort cannot leave a stale scope
behind, and `reconcileSort` keeps working unchanged.

---

## Phase 1: Zakres sortowania w menu kolumny

### Overview

The sort gains a scope, the header menu offers both, and the section bands step aside under the global
one.

### Changes Required:

#### 1. Sort state type

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`

**Intent**: Carry the chosen scope alongside field and direction so a cleared sort cannot leave a
stale scope behind.

**Contract**: `V2SortStateT` becomes `{ field: string; dir: SortDirT; scope: SortScopeT } | null`,
where `SortScopeT = 'section' | 'global'` is exported from `src/lib/kosztorys/row-view.ts` next to
`SortDirT`.

#### 2. Header menu

**File**: `src/components/kosztorys/editor/grid/sort-header.tsx`

**Intent**: Offer four sort commands with the scope spelled out in the label, so direction and scope
are one gesture and no mode can be entered by accident. The active one is marked, as the current two
already are via icon opacity.

**Contract**: `PropsT.active` becomes `{ dir: SortDirT; scope: SortScopeT } | null`; `onSort` takes
`({ dir, scope }) | null`. Labels: „Sortuj rosnąco w sekcjach", „Sortuj malejąco w sekcjach",
separator, „Sortuj rosnąco w całym kosztorysie", „Sortuj malejąco w całym kosztorysie", separator,
„Wyczyść sortowanie". Reuse the existing `ArrowUp` / `ArrowDown` / `ChevronsUpDown` icons; the trigger
icon still reflects direction only.

#### 3. View pipeline

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Pick the sorting function off the scope, and propagate the scope to the band builder so a
global sort suppresses the bands it would otherwise break.

**Contract**: `setSortField(field, next)` where `next` is `{ dir, scope } | null`. `viewRows` calls
`sortRows` when `sort.scope === 'global'`, `sortRowsWithinSections` otherwise. The hook exposes the
active scope to the body component so `buildSectionBandRows` can be told to stand down.

#### 4. Section bands

**File**: `src/lib/kosztorys/section-band-rows.ts`

**Intent**: Restore the early-return kill switch removed in EX-682 — a global sort scatters a
section's rows, and the band builder presumes contiguity, so bands must not be built under it.

**Contract**: `OptsT` gains `enabled: boolean`; when false the rows pass through untouched. Call site
in `src/components/kosztorys/editor/kosztorys-editor-body.tsx` passes
`enabled: sort?.scope !== 'global'`.

### Success Criteria:

#### Automated Verification:

- New unit spec for the scope split passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view-sort-scope.test.ts`
- The restored band kill-switch spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/section-band-rows.test.ts`
- Existing within-sections spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view-sort-within-sections.test.ts`

#### Manual Verification:

- „Sortuj rosnąco w sekcjach" po „Opis" porządkuje pozycje wewnątrz sekcji, kolejność sekcji bez zmian, pasy widoczne
- „Sortuj rosnąco w całym kosztorysie" daje jedną płaską listę, pasy sekcji znikają
- Przełączanie między zakresami bez czyszczenia sortowania działa w obie strony
- Znacznik w menu pokazuje aktywny zakres i kierunek
- „Wyczyść sortowanie" przywraca kolejność z `display_order` i pasy sekcji

---

## Phase 2: Zapis kolejności całego kosztorysu

### Overview

The server-side write and its guard, plus the planner that produces it. No UI reaches it in this
phase.

### Changes Required:

#### 1. Whole-kosztorys plan

**File**: `src/lib/kosztorys/display-order-plan.ts`

**Intent**: Produce one before/after ref pair covering every section, by running the existing
per-section plan over each section and concatenating. Each section is still renumbered 0…n-1
independently, which is what keeps the section boundary intact.

**Contract**: `planKosztorysRenumber(rows, getValue, dir): { before: DisplayOrderRefT[]; after:
DisplayOrderRefT[] }`. Section iteration order does not matter — the refs are keyed by id.

#### 2. Server action

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Write the whole-kosztorys renumber in one statement, refusing entirely if any submitted id
belongs to another investment. Ids arrive from the client and the UPDATE joins on id alone, so the
ownership check is the only thing standing between a caller and someone else's rows.

**Contract**: `renumberKosztorysOrderAction(investmentId: number, refs: { id: number; displayOrder:
number }[]): Promise<ActionResultT>`, via `protectedAction(..., ['kosztorysItems'])` and
`validateAction(renumberDisplayOrderSchema, refs)`. The guard counts `kosztorys_items` rows matching
`investment_id = $1 AND id IN (...)` and refuses unless the count equals `refs.length` — the same
shape as `renumberItemOrderAction`'s section guard, one column over.

Note: `renumberDisplayOrderSchema` rejects duplicate `displayOrder` values across the whole ref list.
A whole-kosztorys plan legitimately repeats index 0 once per section, so the schema's uniqueness
refinement must be relaxed to "unique per id" or the action must validate with a variant that drops
that refinement. Deciding this wrongly fails every multi-section bake — check it first.

### Success Criteria:

#### Automated Verification:

- New unit spec for the whole-kosztorys planner passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/display-order-plan.test.ts`
- New DB spec for the action passes against `db-test`: `bash scripts/test-integration.sh`
- Existing section-scoped DB spec still passes (same run)

#### Manual Verification:

- (none — no UI reaches this phase)

---

## Phase 3: „Utrwal kolejność w całym kosztorysie" w menu

### Overview

The new command in the row menu, its undo entry, and the scope-dependent disabling of both bake
commands.

### Changes Required:

#### 1. Editor handler

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Plan from the full row set (never `viewRows` — search and „tylko rozjechane" would
renumber only what survived the filter and interleave it with the hidden rows), apply optimistically,
write once, and push a single undo command covering every section.

**Contract**: `handlePersistKosztorysOrder()` mirroring `handlePersistSectionOrder`: bails when no sort
is active or the scope is `'global'`; uses `rowsRef.current` and `columnSortValue`; applies via
`applySectionOrder` per section (or a whole-set equivalent); calls
`renumberKosztorysOrderAction(investmentId, after)`; pushes one `pushCommand` labelled
„Utrwalenie kolejności kosztorysu" with `before`/`after` swapped for undo.

#### 2. Column options + column builder

**Files**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Carry the new callback through to the action cell alongside the existing section bundle.

**Contract**: `onPersistKosztorysOrder?: () => void` on the opts; passed into
`KosztorysRowActionsMenu` as a `kosztorys` bundle sibling to `section`, gated by the same
`editorOnly()` presence check the section bundle uses.

#### 3. Row actions menu

**File**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`

**Intent**: Add a third labelled group whose label carries the scope, matching how „Praca" and
„Sekcja" already disambiguate identical commands. Disable both bake commands under a global sort with
the reason stated, since a global order cannot be expressed in `display_order`.

**Contract**: `PropsT` gains `kosztorys?: { onPersistOrder: () => void }` and `sortScope: SortScopeT |
null` (replacing or complementing `sortActive`). New group: separator, `DropdownMenuLabel`
„Kosztorys", one item „Utrwal kolejność w całym kosztorysie" with the `ListOrdered` icon. Both bake
items are disabled when the scope is `'global'`, with the tooltip explaining that a whole-kosztorys
order mixes sections and cannot be stored; unchanged behaviour under `'section'` and no sort.

### Success Criteria:

#### Automated Verification:

- Menu spec covering the three disabled/enabled states of both bake items passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.test.tsx`

#### Manual Verification:

- Menu wiersza → grupa „Kosztorys" → „Utrwal kolejność w całym kosztorysie" porządkuje wszystkie sekcje
- Po wyczyszczeniu sortowania i przeładowaniu strony kolejność została w każdej sekcji
- Cmd+Z cofa utrwalenie w całym kosztorysie jednym krokiem; Cmd+Shift+Z ponawia
- Przy sortowaniu „w całym kosztorysie" obie pozycje „Utrwal…" są wyszarzone i tłumaczą dlaczego
- „Utrwal kolejność" (sekcyjna) działa jak dotąd, nietknięta
- Utrwalenie przy wpisanej frazie w wyszukiwarce porządkuje wszystkie wiersze, nie tylko widoczne
- Podgląd dla klienta: grupy „Sekcja" i „Kosztorys" w ogóle się nie pokazują

---

## Testing Strategy

### Unit Tests:

- Scope split: `'global'` produces one flat order across sections; `'section'` keeps section order —
  same fixture, both directions, so the two cannot silently converge.
- Band kill-switch: rows pass through untouched when disabled (the spec deleted in EX-682, restored).
- Whole-kosztorys planner: every section renumbered 0…n-1; `before` carries stored indices including
  gaps; no ids from outside the kosztorys.

### Integration Tests:

- DB spec for `renumberKosztorysOrderAction`: persisted order after a multi-section renumber; refusal
  with zero writes when an id belongs to another investment; refusal on a malformed ref list.

### Manual Testing Steps:

Aggregated into `context/foundation/manual-checks.md` at the final phase.

## Performance Considerations

A kosztorys can exceed 1000 items, and the whole-kosztorys bake sends one ref per item. That is a
single `UPDATE … FROM (VALUES …)` with ~1000 tuples — well within a statement's reach, and the same
lock discipline (`ORDER BY id FOR UPDATE`) the section variant already uses, so it cannot deadlock
against `shiftDisplayOrderFrom`. No batching needed; if the payload ever becomes a problem it is a
request-size issue, not a database one.

## Migration Notes

None — no schema change. `display_order` already exists and is already written by the section-scoped
variant.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- DB-backed suite passes: `bash scripts/test-integration.sh`
- Build succeeds: `pnpm exec next build --webpack`

## References

- Change notes and decisions: `context/changes/2026-08-13-kosztorys-sort-scope-and-bake/change.md`
- Predecessor slice (EX-682 / EX-683): branch `konradantonik/ex-682-sort-within-sections`
- Section-scoped bake: `src/lib/actions/kosztorys.ts` (`renumberItemOrderAction`)
- Lock discipline rationale: EX-632, `src/lib/kosztorys/display-order.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zakres sortowania w menu kolumny

#### Automated

- [x] 1.1 New unit spec for the scope split passes — f47aaf57
- [x] 1.2 The restored band kill-switch spec passes — f47aaf57
- [x] 1.3 Existing within-sections spec still passes — f47aaf57

### Phase 2: Zapis kolejności całego kosztorysu

#### Automated

- [x] 2.1 New unit spec for the whole-kosztorys planner passes — 2acfabc5
- [x] 2.2 New DB spec for the action passes against `db-test` — 2acfabc5
- [x] 2.3 Existing section-scoped DB spec still passes — 2acfabc5

### Phase 3: „Utrwal kolejność w całym kosztorysie" w menu

#### Automated

- [x] 3.1 Menu spec covering the disabled/enabled states of both bake items passes — covered at logic level (`src/__tests__/lib/kosztorys/sort-lock-hints.test.ts`): the repo has no DOM render harness (no testing-library/jsdom), so the scope→disabled/reason decision was extracted to `src/lib/kosztorys/sort-lock-hints.ts` and asserted there

### Whole-tree Gate

- [ ] G.1 `pnpm typecheck`
- [ ] G.2 `pnpm lint`
- [ ] G.3 `pnpm test` + `bash scripts/test-integration.sh`
- [ ] G.4 `pnpm exec next build --webpack`
