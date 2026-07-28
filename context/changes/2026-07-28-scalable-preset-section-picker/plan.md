# Scalable „Dodaj sekcję z szablonu" Picker — Implementation Plan

## Overview

Replace the picker's single flat cmdk list with two panes: szablony on the left (searchable by name),
the highlighted szablon's sekcje on the right (tickable, no search). Selection stays cumulative across
szablony and confirms once. Below the `md` breakpoint the same two panes become a drill-in: szablon
list → sekcje → back.

## Current State Analysis

`src/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog.tsx` is the whole feature —
fetch-on-open, grouping, selection state, and rendering in one file (~190 lines).

- The server side needs no change. `listPresetSections` (`src/lib/db/presets.ts:96`) already returns a
  flat `PresetSectionMetaT[]` (`presetId, presetName, sectionId, sectionName, itemCount`), ordered
  `created_at DESC, id DESC` across presets and by `displayOrder` within each. The dialog's existing
  consecutive-run grouping loop (`add-sections-from-preset-dialog.tsx:98-103`) is exactly the left
  pane's data, unchanged.
- Selection is a `Set<"presetId:sectionId">` keyed by `metaKey` — a section id is only unique _within_
  its preset. That key stays; it is what makes cumulative cross-szablon selection work today.
- `appendPresetSectionsAction` takes `{presetId, sectionId}[]` and is covered by
  `src/__tests__/lib/kosztorys/append-preset-sections.test.ts`. Untouched by this change.
- `src/components/ui/command.tsx:25` hard-defaults cmdk's `filter` to `foldFilter`, and cmdk only
  scores **mounted** items. This is the constraint `change.md` flags — it stops mattering here only
  because the new picker drops cmdk (below).
- `DialogContent` (`src/components/ui/dialog.tsx`) is `max-w-[min(90vw,600px)]` at base and full-bleed
  `inset-0` below `sm`. `invoice-preview-dialog.tsx:76` is the one precedent for widening
  (`sm:max-w-4xl`).
- No media-query hook exists in `src/hooks/` and nothing in `src/` calls `matchMedia`. Responsive in
  this repo is pure Tailwind.
- `useSearchFilter` (`src/hooks/use-search-filter.ts`) is the repo's existing list-filter hook, used by
  six tables. It compares with plain `.toLowerCase()`, so an ASCII query does not match a Polish label
  — unlike `foldFilter`, which cmdk got.

## Desired End State

Opening „Dodaj sekcję z szablonu" shows two panes side by side. The left lists every szablon with its
sekcja count and, once something is ticked in it, a `3/10` figure; a search box above it filters
szablony by name. Clicking a szablon fills the right pane with its sekcje — each tickable, with
„Zaznacz wszystkie" on top. Ticks accumulate across szablony; „Dodaj (N)" appends them all in one call.
On a narrow screen only one pane is visible at a time, with a back affordance from sekcje to szablony.

Verified by: opening the picker on a desktop viewport shows both panes; ticking sekcje in two different
szablony and confirming appends all of them; the same dialog at 390px width shows one pane and
navigates back and forth.

### Key Discoveries:

- Left-pane data is free — the existing grouping loop already produces `{presetId, presetName, metas}`.
- Search over **sekcja** names was considered and rejected by the owner: sekcja names repeat across
  szablony, so cross-szablon sekcja hits would be a list of identical names, and the sekcje inside a
  szablon almost never change, so the user knows what a szablon contains from its name alone.
- cmdk earned its place on one flat list. With a szablon-name-only search over ~dozens of rows and no
  search in the right pane, it becomes a constraint (mounted-items filtering, behavior smuggled into
  `value` strings) with nothing left to pay for it.
- The „Zaznacz wszystkie" row already carries a deliberate invariant
  (`add-sections-from-preset-dialog.tsx:146-149`): it must never mass-select a filtered view, because
  the hidden rest would be included silently. In the new shape it lives in the unfiltered right pane,
  so the invariant holds structurally rather than by a careful `value` string.

## What We're NOT Doing

- **No search over sekcja names**, cross-szablon or within a szablon. This drops a capability today's
  flat list has (find a sekcja without knowing its szablon) — an accepted trade, for the reasons in Key
  Discoveries. Revisit only if the szablon library grows past what a name search can navigate.
- No tri-state / indeterminate checkbox on the left rows — the `3/10` figure is the answer to partial
  selection.
- No change to `listPresetSections`, its ordering, `appendPresetSectionsAction`, or any DB/schema.
- No new shared `useMediaQuery` hook.
- No reordering of the szablon list (stays `created_at DESC` — the just-saved szablon stays on top).
- No component-level render tests (React Testing Library is not set up in this repo); the derivation is
  tested as pure logic, the layout manually.

## Implementation Approach

Pull the pure derivation (flat metas → szablon groups → per-group selection counts) out of the
component into a sibling module so it can be unit-tested without a renderer, then rebuild the component
around two panes reading from it. Ship the desktop layout before the narrow-screen behavior, so each
phase is independently verifiable.

Both panes always render. Below `md`, a `pane: 'presets' | 'sections'` state drives Tailwind
`hidden`/`flex` classes — the hidden pane stays mounted. This is not merely to avoid a hook: it keeps
the two phases' markup identical, so Phase 3 adds classes rather than restructuring Phase 2's JSX.

## Critical Implementation Details

**Highlight vs. tick are different gestures on the left pane.** Clicking a szablon row only highlights
it (fills the right pane) — it never ticks anything. The whole-szablon load goes through
„Zaznacz wszystkie" in the right pane. One row, one meaning; the `3/10` is a readout, not a control.

**Selection survives filtering and highlighting.** `selected` is keyed by `metaKey`, never by index or
by "currently visible". Filtering the left pane or switching szablony must not touch it — a szablon
filtered out of view keeps its ticks, and they still appear in „Dodaj (N)" and in the confirm payload.
This is the one place where the two-pane rebuild can silently regress cumulative selection.

## Phase 1: Extract the derivation, fold the search

### Overview

Pure logic first: the grouping + counting the panes read from, and a diacritic-folding search that
matches Polish szablon names from an ASCII query.

### Changes Required:

#### 1. Picker derivation module

**File**: `src/components/kosztorys/editor/dialogs/preset-picker-groups.ts` (new)

**Intent**: Move the consecutive-run grouping loop out of the component and give it the two figures the
left pane renders — total sekcje in a szablon, and how many of them are currently ticked. Colocated
with its only consumer per the repo's feature-first placement.

**Contract**: Exports `metaKey(meta: PresetSectionMetaT): string` (moved verbatim from the component —
it is the selection-key contract the confirm payload depends on) and
`groupPresetSections(metas: PresetSectionMetaT[], selected: Set<string>): PresetGroupT[]`, where
`PresetGroupT = { presetId: number; presetName: string; metas: PresetSectionMetaT[]; selectedCount: number }`.
Grouping stays consecutive-run over the given order — it must not re-sort, since the query's ordering is
the left pane's ordering.

#### 2. Diacritic-folding list search

**File**: `src/hooks/use-search-filter.ts`

**Intent**: Compare both the query and the searchable text through `foldText` instead of
`.toLowerCase()`, so „Łazienka" is reachable by typing `lazienka`. cmdk callers already got this via
`foldFilter`; the six table callers of this hook did not.

**Contract**: Same signature and return shape. Only the comparison changes — `foldText(text).includes(foldText(term))`,
using the existing `src/lib/utils/fold-text.ts`. Strictly widens what matches; no caller's contract changes.

#### 3. Unit spec for the derivation

**File**: `src/__tests__/components/kosztorys/preset-picker-groups.test.ts` (new)

**Intent**: Guard the two things the panes can't render correctly without: that consecutive metas from
one preset collapse into one group in source order, and that `selectedCount` counts only the ticks
belonging to that group — the `3/10` figure and, indirectly, the cross-szablon cumulative invariant.

**Contract**: Cases — empty input → `[]`; two presets interleaved-by-order stay in source order; a
`selected` set spanning two presets yields the right `selectedCount` on each; a `selected` key for a
preset not in the input is ignored.

### Success Criteria:

#### Automated Verification:

- Unit spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/preset-picker-groups.test.ts`
- Existing search-filter and preset specs still pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/append-preset-sections.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Typing `lazienka` into an existing table's search box (e.g. investments) matches a „Łazienka" row.

---

## Phase 2: Two-pane picker (desktop)

### Overview

Rebuild the dialog body around the two panes. cmdk goes away; the dialog widens.

### Changes Required:

#### 1. The picker component

**File**: `src/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog.tsx`

**Intent**: Replace the single `Command` list with a left szablon pane and a right sekcja pane. Keep
the fetch-on-open effect, the `handleOpenChange` reset, `toggle`, `toggleGroup`, and `handleConfirm`
exactly as they are — the selection model is not what's changing. Drop the `Command*` imports; use
`useSearchFilter` (over `presetName`) for the left pane and plain scrollable lists for both.

**Contract**: Props unchanged (`investmentId`, `open`, `onOpenChange`, `onAppended`). New local state:
`activePresetId: number | null`, defaulting to the first group once `sections` loads. Left row renders
`presetName`, `{metas.length} sekcji`, and `{selectedCount}/{metas.length}` only when `selectedCount > 0`;
it sets `activePresetId` and nothing else. Right pane renders the active group's „Zaznacz wszystkie"
row (`toggleGroup`, existing all-or-nothing semantics) followed by its metas with the existing check +
`{itemCount} poz.` layout. `DialogActions` and the „Dodaj (N)" counter are untouched.

**Contract (layout)**: `DialogContent` grows from `sm:max-w-md` to `sm:max-w-3xl`, following
`src/components/dialogs/invoice-preview-dialog.tsx:76`'s precedent for an override. The two panes are a flex row with a
`border-l` between them; each pane scrolls independently under a shared max height so the dialog itself
does not scroll.

**Contract (empty/loading)**: The existing three states stay — `sections === null` → „Ładowanie
szablonów…", `[]` → „Brak zapisanych szablonów.". A fourth is new: the left pane filtered to nothing
needs its own „Nie znaleziono szablonu." (previously `CommandEmpty` covered this).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- No stale cmdk import remains: `grep -n "components/ui/command" src/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog.tsx` returns nothing

#### Manual Verification:

- Both panes render side by side; clicking a szablon on the left fills the right pane with its sekcje.
- Ticking sekcje in szablon A, switching to szablon B, ticking more, then „Dodaj (N)" appends all of
  them — the counter reflects the cross-szablon total throughout.
- „Zaznacz wszystkie" ticks the whole active szablon; clicking it again unticks it; the left row's
  `N/N` figure tracks it.
- Filtering the left pane to hide a szablon that has ticks does not change „Dodaj (N)", and clearing
  the filter shows those ticks still set.
- Searching a name with Polish characters matches from an ASCII query.
- Closing and reopening resets both the selection and the search box.

---

## Phase 3: Narrow-screen drill-in

### Overview

The same two panes, one at a time below `md`, with a back affordance.

### Changes Required:

#### 1. Pane switching

**File**: `src/components/kosztorys/editor/dialogs/add-sections-from-preset-dialog.tsx`

**Intent**: Below `md`, show exactly one pane. Picking a szablon on the left advances to the sekcje;
a back control returns. Above `md` both are always visible and the pane state is inert.

**Contract**: New state `pane: 'presets' | 'sections'`, reset to `'presets'` in `handleOpenChange`.
Panes carry `hidden`/`flex` classes gated on `pane` at base and forced visible from `md:` up — both
stay mounted at every width. The left row's click handler sets `activePresetId` **and** `pane`. The
right pane gets a back row/button visible only below `md` (`md:hidden`), labelled with the active
szablon's name. `DialogContent` keeps its existing below-`sm` full-bleed behavior.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- At 390px width the dialog shows only the szablon list; tapping one shows only its sekcje; back
  returns to the list with the szablon still highlighted.
- Ticks made before going back are still set after returning and drilling into another szablon;
  „Dodaj (N)" totals both.
- Resizing across the `md` breakpoint mid-selection does not lose ticks or strand the user on a
  hidden pane.
- The dialog at 390px does not scroll horizontally, and the footer stays reachable.

---

## Testing Strategy

### Unit Tests:

- `groupPresetSections` — grouping in source order, per-group `selectedCount`, foreign keys ignored,
  empty input.

### Manual Testing Steps:

1. Save two szablony from different kosztorysy so the library has more than one entry.
2. Open „Dodaj" → „Sekcja z szablonu…" in the editor; confirm two panes.
3. Tick two sekcje in szablon A, switch to szablon B, „Zaznacz wszystkie", confirm the counter is
   `2 + N`, then „Dodaj" — verify every ticked sekcja lands in the grid.
4. Reopen; confirm the selection and search box are empty.
5. Narrow the viewport to 390px and repeat step 3 through the drill-in.

## Performance Considerations

The picker loads every preset's full payload server-side to count items (`listPresetSections` reads
`payload` for each row). That cost is unchanged by this plan, and it is the same one the current picker
already pays on every open. Worth revisiting only if the library reaches a size where the fetch itself
is felt — not part of this change.

## References

- Change brief: `context/changes/2026-07-28-scalable-preset-section-picker/change.md`
- Preceding work: `context/archive/2026-07-28-drop-empty-kosztorys-scaffold/` (EX-615), commit `7ff77041`
- Widened dialog precedent: `src/components/dialogs/invoice-preview-dialog.tsx:76`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extract the derivation, fold the search

#### Automated

- [x] 1.1 Unit spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/preset-picker-groups.test.ts`
- [x] 1.2 Existing preset specs still pass
- [x] 1.3 Type checking passes: `pnpm typecheck`
- [x] 1.4 Linting passes: `pnpm lint`

### Phase 2: Two-pane picker (desktop)

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Linting passes: `pnpm lint`
- [ ] 2.3 No stale cmdk import remains in the picker

### Phase 3: Narrow-screen drill-in

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 Linting passes: `pnpm lint`
- [ ] 3.3 Full unit suite passes: `pnpm test`
