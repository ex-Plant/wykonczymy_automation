# Stawka „auto" w katalogu prac — Implementation Plan

## Overview

The katalog prac (cennik) can only hold a frozen amount for each of the two subcontractor stawki.
This change adds a third possibility per plane: **auto** — the katalog row carries no stawka of its
own, and the praca prices off the target investment's global coefficient the moment it lands in a
rozpiska. The two planes decide independently, so one praca may be fixed „z narzędziami" and auto
„bez narzędzi".

## Current State Analysis

- `work_catalogue_items.w_tools_rate` / `own_tools_rate` are `numeric NOT NULL`
  (`src/migrations/20260901_0_add_work_catalogue_items.ts`), mirrored by `required: true, min: 0` in
  `src/collections/work-catalogue-items.ts`. There is no representation for „no stawka".
- `toCatalogueCandidate` (`src/lib/kosztorys/work-catalogue/item-to-catalogue.ts:41`) calls
  `subcontractorPrice` on both planes, so a rozpiska row that overrides **nothing** still freezes
  `clientPrice × współczynnik inwestycji` into the katalog. That is the behaviour the owner's ruling
  changes.
- `appendCatalogueItems` (`src/lib/kosztorys/work-catalogue/append-catalogue-items.ts:15`) writes
  `wToolsOverrideType: 'amount'` / `ownToolsOverrideType: 'amount'` for every inserted praca, and its
  local `asPricing` passes `globalWToolsCoeff: 0, globalOwnToolsCoeff: 0` **because** both planes are
  frozen — that shortcut stops holding the moment a plane is auto.
- The derivation auto needs already exists and needs no new maths: `subcontractorPrice`
  (`src/lib/kosztorys/calc.ts:68`) falls through to `row.clientPrice * effectiveCoeff(row, view)`
  whenever the override type is `null`. „Auto" in the rozpiska **is** the absence of an override.
- The 80% ceiling already has a precedent for staying silent when there is nothing to take a share
  of: `checkSubcontractorPrice` returns `null` when `!(row.clientPrice > 0)`
  (`src/lib/kosztorys/subcontractor-price-guard.ts`).
- Migration `20260901_0` is committed (`4a296fda`) but **on no remote branch**, so production has
  never run it — yet it HAS run on the local dev DB and on `db-test`. Editing it in place would
  therefore be a no-op on the two databases that already have the table.
- Three other readers compute the same figures and must learn what auto means:
  `buildCatalogueComparison`, `buildCatalogueSeed`, and the table/dialogs that render three kwoty.
- Production holds zero kosztorys and zero katalog rows (AGENTS.md), so nothing is backfilled and no
  compat shim is owed. Locally-seeded katalog rows keep their frozen amounts — a frozen amount stays
  a perfectly valid katalog row after this change.

## Desired End State

A katalog row's stawka is either **a kwota** (unchanged behaviour: the number travels into every
rozpiska verbatim) or **auto** (`NULL`), in which case a praca inserted from the katalog carries no
override on that plane and prices off the target investment's global coefficient. „Auto" is a
deliberate choice everywhere it can be made — a toggle in the formularz, the word „auto" in the
listing and in both dialogs — never an empty field.

Verifiable by: creating a katalog praca with „bez narzędzi" set to auto, inserting it into two
investments with different global coefficients, and seeing two different stawki bez narzędzi while
the „z narzędziami" kwota is identical in both.

### Key Discoveries:

- `subcontractorPrice` already implements auto (`calc.ts:73`) — the change is about _which rows get
  an override_, not about a new pricing path.
- `CatalogueSourceItemT` already carries `wToolsOverrideType` / `ownToolsOverrideType`
  (`work-catalogue/types.ts`), so `toCatalogueCandidate` can decide per plane without a new read.
- `buildCatalogueSeed` reads `KosztorysItemT`s straight from a snapshot payload, so the override
  types are available there too — the seed can apply the same rule with no new input.
- Both `asPricing` adapters that pass `globalWToolsCoeff: 0` do so with a written justification that
  becomes false here; the comments are load-bearing and must be rewritten, not deleted.

## What We're NOT Doing

- **No backfill and no conversion** of existing katalog rows — a frozen kwota stays a frozen kwota.
- **Not touching the rozpiska's own cells.** The grid already supports „no override"; nothing in
  `kosztorys-v2-columns` / the override editors changes.
- **Not extending the 80% guard with investment context.** The owner's ruling removes the only reason
  it would have needed it.
- **Not adding a katalog-level coefficient.** „Auto" means _the investment's_ coefficient; a
  katalog-level coefficient would be a fourth concept nobody asked for.
- **No E2E in this change** — browser-level coverage is authored or filed at the review gate.

## Implementation Approach

`NULL` is the representation, because it is the exact database analogue of the rozpiska's `NULL`
override type — one absence, spelled the same way on both sides of the seam. Everything downstream
then reduces to one question per plane: is the stawka a number or not.

The migration relaxes a constraint, which is the **additive** direction (the new code needs the
column to accept `NULL`), so prod migrates BEFORE the code ships — a human runs
`pnpm db:migrate:prod`.

## Critical Implementation Details

**Migration direction and ordering.** A separate `20260901_1` rather than an edit to `20260901_0`:
the first migration is unpushed but already applied to the local dev DB and to `db-test`, so an
in-place edit would silently leave both with `NOT NULL` while `payload migrate` reports nothing to
do.

**The seed's winner rule gains a third bucket.** `winningValue` in `build-catalogue-seed.ts` folds
values into grosze and picks the most frequent, ties to the higher. Auto is not a value in that
space, so it becomes a separate bucket counted alongside them: most occurrences win, and on a tie a
kwota beats auto — a typed kwota is a decision, auto is what a row looks like when nobody decided.

---

## Phase 1: Model danych — NULL jako „auto"

### Overview

Make the two stawka columns nullable end to end: migration, collection, type, row mapper, INSERT.
No behaviour changes yet — every writer still writes a number, so the tree stays green.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20260901_1_work_catalogue_auto_rates.ts` (new)

**Intent**: Let the two stawka columns hold `NULL`, which is how „auto" is spelled. Hand-written per
the repo rule; copy the structure of `20260901_0`.

**Contract**: `up` drops `NOT NULL` from `work_catalogue_items.w_tools_rate` and `own_tools_rate`;
`down` restores it with a plain `SET NOT NULL` on both. No row cleanup in `down` — production holds
no katalog rows and none with auto will exist (owner, 2026-09-01), and a down run against a local DB
carrying one should fail loudly rather than delete a row behind your back.

#### 2. Collection

**File**: `src/collections/work-catalogue-items.ts`

**Intent**: `wToolsRate` and `ownToolsRate` stop being required — absent means auto.

**Contract**: drop `required: true` on both fields (keep `min: 0`). Labels unchanged.

#### 3. Type and reader

**File**: `src/lib/kosztorys/work-catalogue/types.ts`

**Intent**: `WorkCatalogueItemT.wToolsRate` / `ownToolsRate` become `number | null`, with `null`
documented as auto. The type's header comment currently argues that both stawki are always frozen
złotówki — rewrite it to state the two cases and why a coefficient still has no place in the katalog.

**Contract**: `wToolsRate: number | null`, `ownToolsRate: number | null` on `WorkCatalogueItemT`
(and therefore on `CatalogueSeedItemT`). `SeedOccurrenceT` gains the same nullability so an
occurrence can record „this praca overrode nothing here".

#### 4. Data access

**File**: `src/lib/db/work-catalogue.ts`

**Intent**: map and write `NULL` faithfully — `Number(null)` is `0`, which would turn every auto row
into a 0 zł stawka on read.

**Contract**: `toCatalogueItem` returns `null` for a `NULL` column rather than `Number(...)`;
`insertCatalogueItems` binds `null` through unchanged (parameterised, so no SQL shape change).

#### 5. Form schema's domain layer

**File**: `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts`

**Intent**: the domain schema the action validates must accept `null` on both stawki, so a payload
from the new form is not refused before Phase 3 wires the UI.

**Contract**: `wToolsRate` / `ownToolsRate` on `workCatalogueItemSchema` become
`money(label).nullable()`. `workCatalogueItemFormSchema` is untouched in this phase.

### Success Criteria:

#### Automated Verification:

- Migration applies against the test DB and the two columns report `is_nullable = YES`
- `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue.test.ts src/__tests__/lib/actions/work-catalogue-save.test.ts src/__tests__/lib/actions/work-catalogue-insert.test.ts`
- `pnpm exec vitest run src/__tests__/components/forms/work-catalogue-item/work-catalogue-item-schema.test.ts`

#### Manual Verification:

- /katalog-prac still lists and edits existing prace unchanged
- „Zapisz do katalogu…" still writes a praca with both kwotami

---

## Phase 2: Reguła auto w logice

### Overview

Teach the four modules that compute or consume the two stawki what auto means. This is where the
owner's two rulings land.

### Changes Required:

#### 1. Kandydat do katalogu

**File**: `src/lib/kosztorys/work-catalogue/item-to-catalogue.ts`

**Intent**: decide per plane. A rozpiska row with its **own** nadpisanie — kwota or mnożnik — freezes
the effective kwota exactly as today; a row with **no** nadpisanie (riding the investment's global
coefficient) becomes auto. Rewrite the doc comment: it currently states the opposite as the rule.

**Contract**: `toCatalogueCandidate` returns `wToolsRate: source.wToolsOverrideType === null ? null :
subcontractorPrice(pricing, 'w_tools')`, and the same for own-tools. `asPricing` and the coefficients
it carries stay — they are what prices the `'coeff'` case.

#### 2. Wstawianie do rozpiski

**File**: `src/lib/kosztorys/work-catalogue/append-catalogue-items.ts`

**Intent**: an auto stawka lands as **no override**, so the row prices off the target investment's
coefficient; a kwota lands frozen as today. The 80% guard stays silent on an auto plane — per the
owner's ruling there is nothing to take a share of at insert time, and the row is checked in the
rozpiska like every other row once it is there.

**Contract**: `asItem` sets `wToolsOverrideType: catalogueItem.wToolsRate === null ? null : 'amount'`
and `wToolsOverrideValue: catalogueItem.wToolsRate ?? 0` (same for own-tools). The `warnings` fold
runs `checkSubcontractorPrice` only for the planes whose katalog rate is a number. The local
`asPricing`'s `globalWToolsCoeff: 0` comment is now true only for the planes still being checked —
rewrite it to say that.

#### 3. Porównanie z katalogiem

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`

**Intent**: an auto katalog stawka is compared as the kwota it implies **for this investment**
(`clientPrice × współczynnik`), so a rozpiska row carrying its own 200 zł against a katalog that says
auto still surfaces as a rozjazd.

**Contract**: the two `figure(...)` calls take `entry.wToolsRate ?? subcontractorPrice(autoPricing,
'w_tools')` where `autoPricing` is the katalog entry's own `clientPrice` under the investment's
coefficients — i.e. the katalog side is priced with the same `settings` the rozpiska side already
uses. Note in a comment that the katalog's cena j.m., not the rozpiska's, is the base.

#### 4. Seed ze szablonu

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-seed.ts`

**Intent**: same rule as „Zapisz do katalogu…" so a cennik does not depend on which route a praca
took into it. An occurrence records auto when that item overrode nothing on the plane; the winner
rule gains auto as a bucket.

**Contract**: `SeedOccurrenceT.wToolsRate` / `ownToolsRate` become `number | null`, written as `null`
when the item's override type is `null`. `winningValue` becomes `winningRate(values: readonly
(number | null)[]): number | null` — counts `null` as its own bucket alongside the grosz buckets,
most frequent wins, and on a tie a kwota beats `null` (a typed kwota is a decision; auto is the
absence of one). `disagrees` compares `null` against a number as a disagreement, so a mixed praca is
still reported as a rozbieżność.

#### 5. Skrypt zasilający

**File**: `src/scripts/seed-work-catalogue.ts`

**Intent**: keep it compiling and keep its report honest about auto.

**Contract**: wherever it prints a stawka, render `null` as `auto`. No logic of its own changes —
the rule lives in `buildCatalogueSeed`.

### Success Criteria:

#### Automated Verification:

- New unit tests for the per-plane rule in `toCatalogueCandidate` (own override → kwota; no override
  → `null`; mixed planes) pass — `src/__tests__/lib/kosztorys/work-catalogue/item-to-catalogue.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-seed.test.ts src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`
- `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue-insert.test.ts src/__tests__/lib/actions/work-catalogue-save.test.ts`

#### Manual Verification:

- A rozpiska praca with no nadpisanie saved to the katalog shows as auto, and one with a własny
  mnożnik shows as a kwota
- Inserting that auto praca into an investment with a different współczynnik gives a different stawka
- „Porównaj z katalogiem" reports a rozjazd on a praca whose rozpiska kwota differs from what auto
  implies

---

## Phase 3: UI — auto jako świadomy wybór

### Overview

Make auto visible and choosable. A blank field keeps meaning „zapomniałem" and keeps its „jest
wymagana" error; auto is a toggle.

### Changes Required:

#### 1. Formularz

**Files**: `src/components/forms/work-catalogue-item/work-catalogue-item-schema.ts`,
`work-catalogue-item-form.tsx`

**Intent**: each stawka gets an „auto" toggle above its amount input. Ticked, the amount input is
hidden and the value saves as `null`; unticked, the existing money validation applies unchanged.

**Contract**: `workCatalogueItemFormSchema` gains `wToolsAuto: z.boolean()` and `ownToolsAuto:
z.boolean()`, and the two money fields become conditional — a `superRefine` on the object that skips
the money guard for a plane whose `*Auto` flag is set (a field-level refinement cannot see a sibling
field). `toData` maps `wToolsAuto ? null : toMoney(value.wToolsRate)`. The form renders `FormCheckbox`
(`src/components/forms/form-components/form-checkbox.tsx`) with the label „Auto — licz ze
współczynnika inwestycji" and hides the paired `field.Input` when it is on.

#### 2. Domyślne wartości i dialogi

**Files**: `src/components/dialogs/add-catalogue-item-dialog.tsx`,
`src/components/dialogs/edit-catalogue-item-dialog.tsx`

**Intent**: both dialogs build `defaultValues` for the form, so both must translate `null` ↔ toggle.

**Contract**: `wToolsAuto: item.wToolsRate === null`, `wToolsRate: item.wToolsRate?.toString() ?? ''`
on the edit dialog; both flags default `false` on the add dialog.

#### 3. Lista /katalog-prac

**File**: `src/components/tables/work-catalogue.tsx`

**Intent**: an auto row reads „auto" where a kwota would be, and its „% ceny klienta" column reads
„—" — the share belongs to an investment, not to the katalog.

**Contract**: `money()` and `shareOf()` accept `number | null`; a `null` rate renders the muted word
`auto` in the stawka column and the existing muted `—` in the share column. Sorting on a `null`
accessor is TanStack's default (nulls last) — leave it.

#### 4. Dialog „Zapisz do katalogu…"

**File**: `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx`

**Intent**: the preview and the nadpisanie confirmation are the owner's last look at what is being
written, so both must say „auto" rather than a kwota.

**Contract**: `PricesT` takes `number | null`; `PriceList` renders `auto` for `null`. The confirm
text's three „stare → nowe" pairs render `auto` on either side. The dialog's `description` currently
promises „stawki zapisują się jako kwoty, wyliczone dla tej inwestycji" — rewrite it to state the
per-plane rule.

### Success Criteria:

#### Automated Verification:

- Form-schema tests cover: auto ticked → blank stawka accepted and mapped to `null`; auto unticked →
  blank stawka still errors „jest wymagana"; one plane auto and the other a kwota
- `pnpm exec vitest run src/__tests__/components/forms/work-catalogue-item/work-catalogue-item-schema.test.ts`

#### Manual Verification:

- „Nowa praca w katalogu" with „bez narzędzi" na auto zapisuje się i pokazuje „auto" na liście
- Odznaczenie auto przy pustym polu nadal daje „Stawka bez narzędzi jest wymagana" pod polem
- Edycja pracy z auto otwiera formularz z zaznaczonym przełącznikiem
- „Zapisz do katalogu…" pokazuje „auto" w podglądzie i w potwierdzeniu nadpisania
- Wstawiona z katalogu praca auto ma w rozpiskie pustą komórkę nadpisania i liczy się ze
  współczynnika inwestycji

---

## Testing Strategy

### Unit Tests:

- `toCatalogueCandidate`: own kwota → frozen; own mnożnik → frozen at the implied kwota; no override
  → `null`; the two planes decided independently
- `buildCatalogueSeed`: a praca whose occurrences all lack an override seeds as auto; a praca whose
  occurrences disagree (auto vs kwota) reports a rozbieżność and the majority wins; a 2-2 tie goes to
  the kwota
- `buildCatalogueComparison`: an auto katalog entry against a rozpiska row with its own kwota reports
  a rozjazd; against a row with no override it matches
- `appendCatalogueItems`: an auto plane writes `overrideType: null`; the 80% warning does not fire for
  an auto plane and still fires for a frozen kwota over the ceiling
- Form schema: the auto flag suppresses the money guard on its own plane only

### Integration Tests:

- The three DB-backed action specs already covering save/insert/list, extended with an auto row

### Manual Testing Steps:

Collected into `context/foundation/manual-checks.md` at the final phase.

## Migration Notes

`20260901_1` relaxes a constraint, so it is **additive**: a human runs `pnpm db:migrate:prod`
**before** the code ships. Note that `20260901_0` has not reached production either — production runs
both, in order, in one go.

Locally: `pnpm exec payload migrate` against the dev DB, and `pnpm db:import:test` +
`pnpm exec payload migrate` (or the usual test-DB reset trio) before running the DB-backed specs.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Poprzedni slice: `context/changes/2026-08-31-work-item-catalog/` (rejestr bramki review)
- Pricing fall-through that makes auto work: `src/lib/kosztorys/calc.ts:68`
- Guard's precedent for staying silent: `src/lib/kosztorys/subcontractor-price-guard.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Model danych — NULL jako „auto"

#### Automated

- [x] 1.1 Migration applies against the test DB and both columns report `is_nullable = YES` — 6900a3f5
- [x] 1.2 The three work-catalogue action specs pass — 6900a3f5
- [x] 1.3 The work-catalogue-item schema spec passes — 6900a3f5

### Phase 2: Reguła auto w logice

#### Automated

- [x] 2.1 New `item-to-catalogue` spec covers the per-plane rule — 4a0eaad1
- [x] 2.2 `build-catalogue-seed` and `build-catalogue-comparison` specs pass — 4a0eaad1
- [x] 2.3 `work-catalogue-insert` and `work-catalogue-save` specs pass — 4a0eaad1

### Phase 3: UI — auto jako świadomy wybór

#### Automated

- [x] 3.1 Form-schema tests cover auto ticked, auto unticked with a blank field, and mixed planes — c89fc34d
- [x] 3.2 The work-catalogue-item schema spec passes — c89fc34d
