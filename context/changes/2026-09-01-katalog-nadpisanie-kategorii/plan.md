# Kategoria kontrolowalna przy nadpisaniu pozycji w katalogu prac — Implementation Plan

## Overview

„Zapisz do katalogu…" → „Nadpisz" writes the whole candidate row, `category` included. That category
is derived from the sekcja of THIS kosztorys, so an overwrite silently reclassifies a praca in the
shared cennik — and neither the preview nor the confirm sentence says so. This change makes the
kategoria a visible, decidable part of the overwrite: shown as a fourth row beside the three money
figures, defaulting to KEEPING the katalog's own category.

## Current State Analysis

- `saveItemToCatalogueAction(itemId, mode)` (`src/lib/actions/work-catalogue.ts:208`) takes exactly
  two arguments and hands `candidate` to `payload.update` whole. There is no seam for a per-field
  decision, so the wire contract has to grow.
- `toCatalogueCandidate` (`src/lib/kosztorys/work-catalogue/item-to-catalogue.ts:42`) sets
  `category: stripSectionOrdinal(source.sectionName) || null`. This is correct for the „nowa" path —
  a brand-new cennik row has no classification of its own — and is exactly wrong for an overwrite.
- `CatalogueSavePreviewT` already carries both sides: `candidate.category` and `existing.category`
  (`src/lib/kosztorys/work-catalogue/types.ts:64`). **No type or query change is needed** — the
  dialog is already holding the information it fails to show.
- `SaveItemToCatalogueDialog` (`src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx`)
  renders `PriceList` twice („W katalogu" / „Po zapisie") over a hardcoded three-row tuple, and shows
  the kategoria only once, in the grey header line next to the j.m. — where it already displays the
  CANDIDATE's value, i.e. it quietly announces the swap as if it were the current state.
- The confirm step is a plain `ConfirmDialog` (`AlertDialog` + one description sentence), not a form —
  it takes text, not controls.
- `src/__tests__/lib/actions/work-catalogue-save.test.ts` already hits the real DB and already
  asserts the persisted `category` on the „nowa" path (line 133). Two new `it()` blocks land in the
  existing file; no new harness.

## Desired End State

Opening „Zapisz do katalogu…" on a praca whose klucz is taken by a cennik row filed under a different
kategoria shows a fourth „Kategoria" row in both blocks and a ticked „Zostaw kategorię z katalogu".
With it ticked (the default) the overwrite changes the three money figures and leaves the kategoria
untouched; unticking it makes „Po zapisie" show the sekcja's kategoria and the confirm sentence name
the move. When both sides already agree on the kategoria, neither the row nor the toggle appears.
Verified by the DB-backed spec asserting the persisted `category` in both modes.

### Key Discoveries:

- Identity in the cennik is opis + j.m. — `catalogueKey` deliberately drops the sekcja
  (`src/lib/kosztorys/work-catalogue/catalogue-key.ts`), enforced by a UNIQUE index. That is why
  forking a pozycja by kategoria is off the table, not merely unimplemented.
- `label` + `<Checkbox onCheckedChange>` is the established row pattern in these dialogs
  (`client-view-settings-form.tsx:36`, `add-items-from-catalogue-dialog.tsx:169`) — no new primitive.
- Existing calls pass two arguments in three places (dialog + two specs), so the new argument is
  added with a default rather than made required.

## What We're NOT Doing

- **No forking a pozycja by kategoria.** Two cennik rows with the same opis + j.m. would break
  inserting from the katalog and violate the UNIQUE klucz. A genuinely different praca gets a
  different opis or j.m.; an investment-specific price gets a nadpisanie on the rozpiska row.
- **No change to the „nowa" path.** A new cennik row keeps taking its kategoria from the sekcja —
  there is no prior classification to protect.
- **No editing the kategoria to a free-typed third value here.** The dialog offers the two values
  that actually exist (katalog's / sekcja's); /katalog-prac is where a kategoria is typed.
- **No migration, no schema change, no data backfill.**

## Implementation Approach

The decision travels as a third argument on the action, defaulting to `true` (protect the cennik),
so the two existing „nowa" call sites in the specs stay untouched and the safe behaviour is what a
caller gets by forgetting. The action applies it in exactly one spot — the `existing` branch of
`'overwrite'` — by overriding `candidate.category` with `existing.category`. The dialog owns the
boolean as local state and derives everything else (whether to show the row, what „Po zapisie" says,
whether the confirm sentence mentions the kategoria) from `existing.category !== candidate.category`.

## Critical Implementation Details

**State sequencing.** `keepCatalogueCategory` must default to `true` and must NOT be reset when the
preview lands — the preview arrives asynchronously after mount, so an effect that syncs the toggle to
the fetched data would stomp a tick the owner made while the confirm dialog was already open. The
toggle is independent of the fetch; only its _visibility_ depends on the preview.

**Empty is a value, not a gap.** `category` is `string | null` on both sides. „bez kategorii" is
rendered as an ordinary value and „zostaw" over a `null` katalog category legitimately means „leave
it empty" — the one case where letting the rozpiska win would reintroduce exactly the silent
overwrite this change removes.

---

## Phase 1: Serwer — decyzja o kategorii na drucie

### Overview

Red-first: the spec asserting the persisted kategoria after an overwrite fails today (the sekcja's
kategoria wins). Then the action grows the third argument and the spec goes green.

### Changes Required:

#### 1. DB-backed spec for the overwrite kategoria

**File**: `src/__tests__/lib/actions/work-catalogue-save.test.ts`

**Intent**: Pin the persisted `category` after an overwrite in both modes — the regression guard the
review-gate finding asked for (`test: test-driven-debugging · integration`). Written and seen failing
before the action changes.

**Contract**: `beforeAll` gains a second kosztorys-sections fixture with a distinct name (pushed to
`createdSections` so `afterAll` cleans it), and `createItem` gains an optional section override so an
item can be created in either. Two new `it()` blocks: an overwrite from the second sekcja with the
argument omitted must leave `category` at the first sekcja's stripped name; the same overwrite with
the argument `false` must persist the second sekcja's stripped name. Both assert the row read back
over raw SQL, like every existing case in the file.

#### 2. The action accepts the decision

**File**: `src/lib/actions/work-catalogue.ts`

**Intent**: Let a caller say „leave the katalog's kategoria alone" without touching anything else the
overwrite writes.

**Contract**: `saveItemToCatalogueAction(itemId: number, mode: 'new' | 'overwrite',
keepCatalogueCategory = true)`; `saveItemToCatalogueSchema` gains `keepCatalogueCategory: z.boolean()`.
Applied only in the `'overwrite'` branch where `existing` is non-null — the create-after-race
fallback and the whole `'new'` path are unchanged, since neither has a prior kategoria to keep. The
default is `true`, so the protective behaviour is what an omitted argument gets.

### Success Criteria:

#### Automated Verification:

- The two new cases fail before the action change and pass after: `set -a; . ./.env; set +a; DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-save.test.ts`
- The four pre-existing cases in that file still pass (same command).

#### Manual Verification:

- (none — this phase has no UI surface)

---

## Phase 2: Dialog — czwarty wiersz i przełącznik

### Overview

Surface the kategoria beside the three money figures, let the owner decide, and make the confirm
sentence tell the truth about what the overwrite will do.

### Changes Required:

#### 1. Kategoria as a fourth row in both preview blocks

**File**: `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx`

**Intent**: Render the kategoria the same way the three money figures are rendered, in „W katalogu"
and „Po zapisie" alike, so the change reads as a change rather than as a fact.

**Contract**: `PriceList` takes an optional `category?: string | null` and, when the prop is passed,
appends a „Kategoria" row rendering the value or „bez kategorii". The prop is passed only when the two
sides disagree — otherwise the blocks stay exactly as they are today. „Po zapisie" shows the katalog's
kategoria while the toggle is ticked and the sekcja's when it is not. The header's grey line keeps
showing the candidate's kategoria only in the create case; on an overwrite the row below is the truth.

#### 2. „Zostaw kategorię z katalogu"

**File**: `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx`

**Intent**: One ticked-by-default checkbox under the preview, present only when the kategorie
actually differ, whose state is what the save sends.

**Contract**: local `useState(true)`; rendered as a `label` + `<Checkbox onCheckedChange>` row
matching `client-view-settings-form.tsx`. `handleSave` passes it as the action's third argument. Not
synced to the preview fetch (see Critical Implementation Details).

#### 3. Confirm sentence names the move

**File**: `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx`

**Intent**: The red confirm step already enumerates the three money changes; a kategoria move is the
fourth thing an overwrite can do and belongs in the same sentence — but only when it will happen.

**Contract**: the `ConfirmDialog` description gains a kategoria clause (`„Wyburzenia i demontaże" →
„Hydraulika"`, with „bez kategorii" for an empty side) appended only when the kategorie differ AND
the toggle is unticked. With the toggle ticked the sentence is unchanged from today.

#### 4. Close the originating finding

**File**: `context/changes/2026-08-31-work-item-catalog/review-gate.md`

**Intent**: The open `[ ]` box that blocks that slice's archive is this change; check it and point at
this change folder.

**Contract**: the box at line 14 flips to `[x]`, disposition `fixed`, with the resolution recorded
(kategoria kept by default, change surfaced, regression guard in `work-catalogue-save.test.ts`).

### Success Criteria:

#### Automated Verification:

- The save spec still passes with the dialog wired: `set -a; . ./.env; set +a; DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-save.test.ts`

#### Manual Verification:

- Nadpisanie pracy, której pozycja w cenniku ma inną kategorię, pokazuje wiersz „Kategoria" w obu blokach i zaznaczony ptaszek „Zostaw kategorię z katalogu"
- Z zaznaczonym ptaszkiem nadpisanie zmienia ceny, a kategoria w /katalog-prac zostaje bez zmian
- Odznaczenie ptaszka przestawia „Po zapisie" na kategorię z sekcji, a zdanie w potwierdzeniu wymienia zmianę kategorii
- Gdy kategoria w cenniku i w sekcji są takie same, ani wiersz „Kategoria", ani ptaszek się nie pokazują
- Pozycja w cenniku bez kategorii pokazuje „bez kategorii" i zachowuje się tak samo (domyślnie zostaje pusta)

---

## Testing Strategy

### Integration Tests:

DB-backed, in the existing `work-catalogue-save.test.ts` against the isolated 5435 container: the
persisted `category` after an overwrite with the decision omitted (katalog's kategoria survives) and
with it `false` (sekcja's kategoria lands). Asserting the persisted row rather than the action's
return value is the point — a `success: true` says nothing about which kategoria was written.

### Not covered by automated tests:

The dialog's derived state (row visibility, „Po zapisie" value, the confirm clause) — this repo has
no component-render harness, and the behaviour is a pure function of two strings the owner can see.
It goes to the manual checks above.

## Migration Notes

None — no schema change, no stored data reinterpreted.

## Whole-tree Gate

Run once, after Phase 2.

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

E2E is deliberately excluded — this slice adds no browser-level risk beyond the manual checks, and
the suite is not run unprompted.

## References

- Originating finding: `context/changes/2026-08-31-work-item-catalog/review-gate.md:14`
- Previous slice on the same surface: `context/changes/2026-08-31-katalog-prac-auto-rates/`
- Klucz/identity rationale: `src/lib/kosztorys/work-catalogue/catalogue-key.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Serwer — decyzja o kategorii na drucie

#### Automated

- [x] 1.1 Dwa nowe przypadki w work-catalogue-save.test.ts czerwone przed zmianą akcji, zielone po — a95f9a04
- [x] 1.2 Cztery istniejące przypadki w tym pliku nadal przechodzą — a95f9a04

### Phase 2: Dialog — czwarty wiersz i przełącznik

#### Automated

- [x] 2.1 work-catalogue-save.test.ts przechodzi z podpiętym dialogiem
