# Client preview settings — per-investment columns, firm-wide defaults, empty-row filter

## Overview

The owner decides which columns a client sees and whether empty rows are hidden, per investment,
with one firm-wide default set as the starting point. The choice is stored server-side, so both
client-facing entrances — the token link `/k/<token>` and the owner's `/podglad-klienta/<id>` —
render it. Today the client view pins its columns in code and clears every row condition, while the
owner's own preferences live in `localStorage`, i.e. in a different browser than the client's.

Linear: **EX-695**.

## Current State Analysis

- **The client view is one render, twice.** `src/app/(share)/k/[token]/page.tsx` and
  `src/app/(share)/podglad-klienta/[id]/page.tsx` both mount `<KosztorysEditorBody preview … />`
  over the same payload from `src/lib/queries/preview-kosztorys.ts`. That sameness is the feature —
  the preview is trustworthy as a check precisely because it is not a second render path.
- **Columns are pinned by an allowlist.** `PREVIEW_VISIBLE_COLUMNS`
  (`src/lib/kosztorys/column-config.ts:166`) is the whole answer under `previewVisible`:
  `selectV2Columns` (`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:646`) skips
  every preference gate (axis, layer, progress display, the hide picker) and returns
  `PREVIEW_VISIBLE_COLUMNS.has(key)`. `assertDisclosurePair` (same file, `:619`) throws unless the
  price plane is pinned to `client` alongside it.
- **Row conditions are cleared in preview.** `use-kosztorys-editor.ts:196` —
  `const engagedConditionIds = preview ? EMPTY_CONDITION_IDS : persistedConditionIds`. The registry
  (`src/lib/kosztorys/row-conditions.ts:37`) discriminates `kind: 'filter'` (the „Filtry" menu) from
  `'diagnostic'` (toolbar counters); `applyRowConditions` splits hiders from keepers on that kind.
- **Owner preferences are browser-local.** `use-hidden-columns.ts` writes
  `table-columns:kosztorys` in `localStorage`, globally (not per investment);
  `use-engaged-conditions.ts` is per investment but still `localStorage`.
- **Sharing already has its own table.** `src/collections/kosztorys-shares.ts` — one row per
  investment, token minted by `generateShareLinkAction`, all three share actions narrowed to
  owner/admin by the local `ownerShareAction` wrapper (`src/lib/actions/kosztorys-share.ts:20`).
  Deliberately uncached: the token lookup runs outside `unstable_cache` so a revoke bites on the
  next request.
- **The heavy read is cached per investment.** `cachedPreviewKosztorysEditorData`
  (`preview-kosztorys.ts:89`) is one `unstable_cache` entry shared by both entrances, tagged with
  the kosztorys collections.
- **Payload has no globals yet.** `src/payload.config.ts` declares `collections` only.

### Key Discoveries

- The allowlist is a **ceiling**, and this change must keep it one: the owner may hide more, never
  reveal a column outside `PREVIEW_VISIBLE_COLUMNS` (no subcontractor prices, no „komentarz").
- Storing **hidden** keys rather than visible ones keeps a later allowlist addition working without
  rewriting every stored row.
- Reading the settings **outside** `cachedPreviewKosztorysEditorData` — one indexed query, the same
  shape as the existing token lookup — means a save is visible on the next request with no new cache
  tag, and a change to the firm-wide defaults does not invalidate every investment's tree payload.
- The „Filtry" menu already lists `kind === 'filter'` only
  (`kosztorys-filters-menu.tsx:52`), so a new kind stays out of it by construction.
- `applyRowConditions` splits `kind === 'filter'` (hiders) from `'diagnostic'` (keepers) — a third
  kind must join the hiders explicitly, not fall through to keepers.
- Kosztorys data is throwaway until dogfooding merges to `main` (AGENTS.md), so the migration owes
  no backfill.

## Desired End State

In „Opcje" → „Klient" there are three items: „Widok klienta", „Udostępnij" and a new „Ustawienia
podglądu…". The last opens a dialog listing every column the client can currently see, grouped, each
tickable, plus one checkbox „Ukryj pozycje bez przedmiaru i bez wykonanej pracy (N)" carrying a live
count. Changes are local until „Zapisz"; a second button saves the current state as the firm-wide
default. „Udostępnij" opens the same settings as step 1, „Dalej" saves and reveals the link screen.

`/podglad-klienta/<id>` renders **exactly** what `/k/<token>` renders — no added chrome, no controls.
Both honour the saved settings.

Verify: hide a column, save, reload the token link in a private window — the column is gone, and the
totals are unchanged.

## What We're NOT Doing

- No control over the bottom summary panel (Do zapłaty, materiały, wpłaty) — it stays as it is.
- No hand-hiding of individual rows (EX-549, cancelled — hiding is a rule, not a per-row tick).
- No hiding of a section that has przedmiar; section folding is not part of the client settings.
- No widening of `PREVIEW_VISIBLE_COLUMNS` — the ceiling does not move in this change.
- No E2E spec in this run (filed to the `e2e-backlog`); no answer to P13 (whether the client should
  read Przedmiar or Pomiar z natury).
- No migration of the owner's existing `localStorage` column preferences — they stay what they are,
  a reading preference for the editor.

## Implementation Approach

One resolver, two writers, two readers.

The settings are `{ hiddenColumns: string[], hideEmptyRows: boolean }`. They live in a new
per-investment collection and in a new Payload global holding the firm-wide default. A single
resolver answers "what does investment N serve", falling back investment → global → code default.
Both preview entrances call it beside (not inside) the cached tree read and pass the result into
`KosztorysEditorBody`, which forwards it to `useKosztorysEditor`, which turns it into two things:
a hidden-key set intersected with the existing allowlist, and one engaged row condition.

The UI is one dialog component mounted in two places — its own menu item, and step 1 of the share
dialog — built from the existing `Dialog`/`DialogHeader`/`Description`/checkbox-row primitives, not
new ones.

## Critical Implementation Details

**Ceiling, not replacement.** The client column filter must stay `PREVIEW_VISIBLE_COLUMNS.has(key)
&& !hidden.has(key)`. Writing it as "the stored list decides" would let a stored key outside the
allowlist reveal a column the ceiling exists to keep off the page.

**The preview render takes no new chrome.** `/podglad-klienta/<id>` must remain byte-identical to
`/k/<token>` (owner ruling, this session). Every control added by this change lives in the editor.

## Phase 1: Storage and resolution

### Overview

The two storage homes, the migration, and the one function that turns them into an answer.

### Changes Required:

#### 1. Per-investment settings collection

**File**: `src/collections/kosztorys-client-view.ts`

**Intent**: Hold one row per investment describing what its client sees. Its own table for the same
reason `kosztorys-shares` is one: `kosztoryses` is the v1 Google-Sheet link row and cannot carry it,
and a client-disclosure decision is not a property of the investment record.

**Contract**: slug `kosztorys-client-view`; fields `investment` (relationship → `investments`,
required, unique), `hiddenColumns` (`json`, defaults `[]` — an array of toggle keys), `hideEmptyRows`
(`checkbox`, required, default `true`). Access mirrors `kosztorys-shares`: read
`isAdminOrOwnerOrManager`, write `isAdminOrOwner`. Registered in `src/payload.config.ts`.

#### 2. Firm-wide defaults global

**File**: `src/globals/kosztorys-client-view-defaults.ts` (new directory)

**Intent**: The starting point every investment inherits until it says otherwise.

**Contract**: A Payload `GlobalConfig`, slug `kosztorys-client-view-defaults`, carrying the same two
fields as the collection. `payload.config.ts` gains a `globals: [...]` key — the first in this repo.

#### 3. Migration

**File**: `src/migrations/<timestamp>_kosztorys_client_view.ts`

**Intent**: Create both tables by hand (AGENTS.md: `migrate:create` emits phantom drift).

**Contract**: `kosztorys_client_view` (id, `investment_id` FK unique → `investments`,
`hidden_columns` jsonb default `'[]'`, `hide_empty_rows` boolean not null default true, timestamps)
plus the Payload global table for the new global. Copy the structure of the newest file in
`src/migrations/`, including the internal Payload bookkeeping a global needs.

#### 4. Resolver

**File**: `src/lib/queries/kosztorys-client-view.ts`

**Intent**: One answer to "what does investment N serve a client", used by both entrances and by the
settings dialog so the dialog can never show a different starting state than the client gets.

**Contract**: `type ClientViewSettingsT = { hiddenColumns: string[]; hideEmptyRows: boolean }` and
`getClientViewSettings(investmentId: number): Promise<ClientViewSettingsT>` — investment row, else
global, else the code default `{ hiddenColumns: [], hideEmptyRows: true }`. Uncached, one indexed
read, `overrideAccess: true` on the investment row (the token path has no session, exactly like the
existing token lookup). Stored keys outside `PREVIEW_VISIBLE_COLUMNS` are dropped on read.

#### 5. Write actions

**File**: `src/lib/actions/kosztorys-client-view.ts`

**Intent**: Save for this investment, and save the current state as the firm-wide default.

**Contract**: `saveClientViewSettingsAction(investmentId, settings)` and
`saveClientViewDefaultsAction(settings)`, both `ActionResultT`, both owner/admin-only. The
owner-narrowing wrapper currently private to `kosztorys-share.ts` moves to a shared module and both
files import it — one narrowing, not a copy.

### Success Criteria:

#### Automated Verification:

- Resolver spec passes: `pnpm exec vitest run src/__tests__/lib/queries/kosztorys-client-view.test.ts`
- Types regenerate cleanly: `pnpm generate:types`
- Migration applies against the local DB: `pnpm payload migrate`

#### Manual Verification:

- Both tables exist locally after the migration, and the global saves from the Payload admin panel.

---

## Phase 2: The render honours the settings

### Overview

Settings reach both entrances and turn into columns and rows.

### Changes Required:

#### 1. Preview reads

**File**: `src/lib/queries/preview-kosztorys.ts`

**Intent**: Both entrances resolve the settings beside the cached tree read, so a save is live on the
next request without a cache tag, and a defaults change never invalidates every investment's payload.

**Contract**: `getPreviewKosztorysByToken` and `getPreviewKosztorysById` return
`KosztorysEditorDataT & { clientView: ClientViewSettingsT }`. The `unstable_cache` callback is
untouched — the settings read sits outside it, next to the token lookup.

#### 2. Body → editor plumbing

**Files**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Carry the settings to the two places that consume them.

**Contract**: `KosztorysEditorBody` takes `clientView?: ClientViewSettingsT` (absent on the owner's
editor render) and passes it to `useKosztorysEditor`. There the preview branches gain it:
`previewHiddenColumns` joins the column opts, and `engagedConditionIds` under `preview` becomes the
client condition's id when `hideEmptyRows`, the frozen empty set otherwise.

#### 3. Column ceiling minus the owner's choice

**Files**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Let the owner subtract from the client's column set without ever adding to it.

**Contract**: opts gain `previewHiddenColumns?: ReadonlySet<string>`; the `previewVisible` branch of
`keep` in `selectV2Columns` becomes
`PREVIEW_VISIBLE_COLUMNS.has(key) && !opts.previewHiddenColumns?.has(key)`. `selectV2ToggleItems`
still returns `[]` under `previewVisible` — the preview has no picker.

#### 4. The client row condition

**File**: `src/lib/kosztorys/row-conditions.ts`

**Intent**: One rule, not two: a row with no przedmiar **and** no work done contributes zero to both
figures the client reads, so hiding it moves no total and needs no warning. Two separate rules would
each be safe for only one of those figures.

**Contract**: `RowConditionKindT` gains `'client'`. A new entry
`{ id: 'client-empty', kind: 'client', sectionLabel: null, matches: (row, ctx) => !(row.plannedQty > 0) && !(rowTotalQtyDone(row, ctx.stages, 'client') > 0) }`
with a label reading as a bare noun phrase after „Pozycje ". `applyRowConditions` treats every
non-`diagnostic` kind as a hider. The „Filtry" menu is untouched — it filters on
`kind === 'filter'`, so the new kind cannot appear there.

#### 5. Live count for the dialog

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: The dialog's „(N)" must say how many pozycje are in that state across the whole dataset,
not how many survive the filter.

**Contract**: `conditionCounts` currently zeroes every count under `preview`; the client condition is
counted in the editor render (where the dialog lives), so no change is needed there — assert it is
reachable from the editor context the dialog reads.

### Success Criteria:

#### Automated Verification:

- Condition spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- Preview column spec passes (ceiling holds, stored keys subtract):
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`

#### Manual Verification:

- A row with no przedmiar and no etapy vanishes from the token link while the totals stay put.
- With `hideEmptyRows` off, that row is back.

---

## Phase 3: „Ustawienia podglądu…" dialog

### Overview

The one settings surface, in the editor, opened from the „Klient" group.

### Changes Required:

#### 1. The settings dialog

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.tsx`

**Intent**: Let the owner tick what the client sees and save it. Built from existing primitives
(`Dialog`, `DialogHeader`, `Description`, the checkbox rows the pickers already use) — no new
component vocabulary.

**Contract**: Props `{ investmentId, open, onOpenChange, settings, onSaved }`. Renders the columns
the client can see, grouped (opis i ilości / ceny i rabat / wartości / etapy i postęp), each a
tickable row; one checkbox „Ukryj pozycje bez przedmiaru i bez wykonanej pracy (N)" with the count
from the editor context; buttons „Zapisz" and „Zapisz jako domyślne". State is local until a save —
closing without saving changes nothing. Reusable as a step: the same body must render inside the
share dialog, so the buttons are a prop, not baked in.

**Contract (grouping)**: the group→column-key map lives beside the dialog as its own module, keyed
by the same toggle keys `PREVIEW_VISIBLE_COLUMNS` uses, so a key present in one and absent from the
other is a typecheck-visible mistake rather than a silently ungrouped row.

#### 2. Menu item

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: A third item in the „Klient" group, between „Widok klienta" and „Udostępnij".

**Contract**: „Ustawienia podglądu…" with a one-line description saying it decides what the client
sees; opens the dialog, which is mounted alongside the menu's other dialogs. Settings are fetched on
select (the same pattern the share item already uses for its token).

### Success Criteria:

#### Automated Verification:

- Grouping spec passes — every allowlisted column key belongs to exactly one group:
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/client-view-groups.test.ts`

#### Manual Verification:

- Unticking a column and clicking „Zapisz" removes it from the token link after a reload.
- Closing the dialog without saving leaves the client link unchanged.
- „Zapisz jako domyślne" makes a second, untouched investment start from that set.
- The menu item is absent for a MANAGER, or refuses on save with the same message the share actions
  use.

---

## Phase 4: „Udostępnij" in two steps

### Overview

Settings first, link second — so a link can never leave with unsaved settings behind it.

### Changes Required:

#### 1. Two-step share dialog

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-share-dialog.tsx`

**Intent**: The settings body from Phase 3 becomes step 1; „Dalej" saves and reveals today's link
screen unchanged.

**Contract**: The dialog gains a step state (`'settings' | 'link'`), always opening on `'settings'`
— every click, not a first-run wizard. Step 1 renders the shared settings body with a „Dalej"
button that saves; step 2 is the existing token UI (generate / copy / rotate / revoke), with a way
back to step 1. Everything already there — the revoke confirm, the copy toast — stays as is.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check: this phase is dialog composition over the Phase 3 body, whose
  saving and grouping are already covered. Verified manually below and by the whole-tree gate.

#### Manual Verification:

- „Udostępnij" opens on the settings step every time, including when a link already exists.
- „Dalej" saves, and the link screen behaves exactly as before (generate, copy, rotate, revoke).

---

## Phase 5: Tests and close-out

### Overview

The guards, the deferred E2E, the docs.

### Changes Required:

#### 1. Unit specs

**Files**: `src/__tests__/lib/queries/kosztorys-client-view.test.ts`,
`src/__tests__/lib/kosztorys/row-conditions.test.ts`,
`src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`,
`src/__tests__/components/kosztorys/editor/dialogs/client-view-groups.test.ts`

**Intent**: Cover the three risks this change actually carries — the ceiling, the rule, and the
fallback chain.

**Contract**: (a) resolution order investment → global → code default, and a stored key outside the
allowlist is dropped; (b) the client condition matches exactly the rows with neither przedmiar nor
any stage quantity, and is invisible to the „Filtry" menu's `kind === 'filter'` list; (c) a stored
hidden key subtracts from the client columns and no stored value can add one; (d) every allowlisted
key belongs to exactly one dialog group.

#### 2. E2E backlog issue

**Intent**: The browser-level risk (owner saves, client link reflects it) is real but deferred.

**Contract**: A Linear issue in project "Wykonczymy", label `e2e-backlog`, naming the scenario and
its test disposition. Its id is recorded in the change's review gate.

#### 3. Docs

**Files**: `context/reference/kosztorys-editor-domain-notes.md`, `context/foundation/roadmap.md`

**Intent**: Record that what a client sees is now a stored per-investment decision, not a constant.

**Contract**: A short section in the domain notes naming the resolution order and the ceiling rule;
the roadmap's client-view line updated if it claims the column set is fixed in code.

### Success Criteria:

#### Automated Verification:

- All four specs pass: `pnpm exec vitest run src/__tests__/lib/queries/kosztorys-client-view.test.ts src/__tests__/lib/kosztorys/row-conditions.test.ts src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts src/__tests__/components/kosztorys/editor/dialogs/client-view-groups.test.ts`

#### Manual Verification:

- The E2E issue exists and carries the `e2e-backlog` label.

---

## Testing Strategy

### Unit Tests

- Resolution order and the allowlist-drop on read.
- The client condition's predicate on all four combinations of (przedmiar, wykonana praca).
- The column ceiling: a stored key subtracts; no stored value adds.
- Dialog grouping totality.

### Integration Tests

None new. The DB-backed layer here is a single-row read with a fallback, covered by the resolver
spec against the test DB.

### Manual Testing Steps

1. Untick two columns in „Ustawienia podglądu…", save, open the token link in a private window —
   both are gone, the totals are unchanged.
2. Turn „ukryj puste pozycje" off, reload the link — the empty rows are back, the totals still
   unchanged.
3. „Zapisz jako domyślne", then open a different investment's settings — it starts from that set.
4. Open „Widok klienta" and the token link side by side — identical.

## Performance Considerations

One extra indexed read per preview request, outside the cached payload. That is the deliberate trade
for not adding a cache tag whose invalidation would drop every investment's tree payload whenever
the firm-wide defaults change.

## Migration Notes

Kosztorys data is throwaway until dogfooding merges to `main` (AGENTS.md), so no backfill: an
investment with no settings row resolves through the global, and the global's own absence resolves
to the code default. The prod migration is a human's deliberate step (`pnpm db:migrate:prod`), owed
only when this ships.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change notes: `context/changes/2026-08-15-client-preview-settings/change.md`
- Linear: EX-695 (this change), EX-549 + EX-666 (cancelled predecessors)
- Column ceiling: `src/lib/kosztorys/column-config.ts:166`, `kosztorys-v2-columns.tsx:619`
- Shared read: `src/lib/queries/preview-kosztorys.ts:89`
- Owner-only action pattern: `src/lib/actions/kosztorys-share.ts:20`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Storage and resolution

#### Automated

- [x] 1.1 Resolver spec passes — 1301267f
- [x] 1.2 Types regenerate cleanly — 1301267f
- [x] 1.3 Migration applies against the local DB — 1301267f

### Phase 2: The render honours the settings

#### Automated

- [x] 2.1 Condition spec passes
- [x] 2.2 Preview column spec passes (ceiling holds, stored keys subtract)

### Phase 3: „Ustawienia podglądu…" dialog

#### Automated

- [ ] 3.1 Grouping spec passes — every allowlisted column key belongs to exactly one group

### Phase 4: „Udostępnij" in two steps

#### Automated

- [ ] 4.1 No phase-scoped automated check (dialog composition over the Phase 3 body)

### Phase 5: Tests and close-out

#### Automated

- [ ] 5.1 All four specs pass
