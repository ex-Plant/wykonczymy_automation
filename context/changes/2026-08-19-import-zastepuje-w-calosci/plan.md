# Import zastępuje całą rozpiskę — key odporny na literówki, „Wyczyść kosztorys"

## Overview

Investment 90 holds 456 rows for 373 unique prace: 83 duplicate copies of work that already exists.
They were manufactured by the import itself. The import advertises „zastąp", but `buildImportPlan`
_retains_ every app praca the sheet doesn't match — appending it into the same-named section beside
the sheet's own copy. Any praca that stops matching becomes a copy instead of disappearing, and
„Popraw literówki w opisie prac" is a machine for stopping matches: the identity key folds case,
diacritics and whitespace, but `cleanDescription` rewrites _letters_ (`fisnish`→`finish`,
`ścianch`→`ścianach`), which folding cannot absorb. Measured on investment 90: one cleaning run
took the unmatched count from 83 to 137.

Three changes, one direction: make the key survive a typo fix, make „zastąp" actually replace, and
give the owner a way to empty the rozpiska outright.

## Current State Analysis

- **`src/lib/kosztorys/sheet-import/item-key.ts`** — `itemKey(section, description, occurrence)` over
  `fold()`. Three consumers key through it: `build-import-plan.ts:170,177`,
  `build-sheet-comparison.ts:191,197`, `build-measured-qty-refresh.ts:61,65`. The compare dialog's
  „Różnica −83" and the import's retain list are two readings of the same key.
- **`src/lib/kosztorys/sheet-import/columns.ts`** — `fold()` absorbs case / Polish diacritics /
  whitespace runs. Nothing letter-level.
- **`src/lib/kosztorys/clean-description.ts`** (new, untracked) — `TYPO_FIXES` + `unshout` +
  `sentenceCase` + `ABBREVIATIONS`. Pure, idempotent by contract, no server-only import.
- **`src/lib/kosztorys/sheet-import/build-import-plan.ts:247–290`** — the retain block. Reuses an
  existing same-named section via `sectionIdByName`, which is why Wyburzenia ended up holding 24
  sheet prace and 22 copies inside one section. Reports through
  `RetainedItemT = { section, description }` (line 51) → `ImportReportT.retained` (line 66).
- **`src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx:214`** — `RetainedBlock` renders
  „…zostanie zachowanych — nic nie jest usuwane", i.e. it advertises the bug as a safety feature.
- **`src/lib/kosztorys/replace-tree-with-snapshot.ts`** — already the one wholesale-replacement path:
  investment lock → forced `manual` snapshot → total wipe of sekcje/etapy (FK cascade takes prace and
  `stage_progress`) → re-insert, all in one transaction. `reloadFromPresetAction` and
  `applyKosztorysImport` both go through it; a reset is a third caller with an empty tree.
- **`src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`** — „Opcje", grouped
  Edycja / Wersje / Szablony / Arkusz Google / Inwestor. `handleCleanDescriptions` (line 82) is the
  shape a reset handler copies: call the action, then `onTreeReplaced?.()` to reseed the grid off the
  investment's revision token.

## Desired End State

Fixing a typo no longer costs a praca its identity: after „Popraw literówki", the compare dialog and
the import still see the same praca the sheet does. „Pobierz z arkusza Google" replaces the rozpiska
outright — what the sheet doesn't have, the app doesn't keep — and the preview says so before the
click, naming the prace that will disappear and marking the ones carrying wpisane etapy. „Wyczyść
kosztorys" empties the rozpiska in one click, snapshotted, undoable through „Wczytaj".

Verify on investment 90: „Wyczyść kosztorys" → „Pobierz z arkusza Google" → the compare dialog reads
373 / 373 / 0.

### Key Discoveries

- The 83 copies are byte-identical to their originals, so **a re-import will not sweep them even
  after the key fix**: two identical opisy in one section key as occurrence #0 and #1, and the sheet
  supplies only #0 — #1 stays unmatched. They need the wipe, which is exactly what Phase 2 + Phase 4
  provide. No repair script.
- **No `stage_progress` row hangs on any item of investment 90** — deleting the copies loses nothing
  there. The etapy marker in Phase 3 is for every _other_ investment, where it will not be true.
- `replaceTreeWithSnapshot` already takes the investment lock and forces a `manual` (365-day,
  prune-exempt) snapshot, so „nic nie jest usuwane" was never the only thing standing between the
  owner and a lost rozpiska — the labelled snapshot was.

## What We're NOT Doing

- **No repair script for investment 90.** The reset button plus a clean import is the sweep; a
  one-off script would be a second, less-tested implementation of the same wipe.
- **No data-preservation path** for the dropped prace. `AGENTS.md` → kosztorys data is throwaway until
  dogfooding merges to `main`, and the forced pre-import snapshot is the safety net regardless.
- **No merge/reconcile UI** — no "keep this one, drop that one" per-row picker in the preview. The
  preview reports; the decision is import or don't.
- **No change to `fold()`.** Widening it to absorb typos would make it a fuzzy matcher and change what
  every other consumer means by "the same text".
- **No change to append-from-preset** (`appendPresetSectionsAction`), which appends by design and says
  so.
- **No separate git branch** (owner: „nie robimy osobnej gałęzi").

## Implementation Approach

The key fix goes first and alone, because it changes what „the same praca" means for all three
consumers at once — import, compare, and the measured-qty refresh. Landing it before the retain
removal also means the retain list shrinks on its own merit rather than being hidden by the removal.

Keying through `cleanDescription` rather than widening `fold()` keeps one definition of normalization
per purpose: `fold()` is "ignore how it's written", `cleanDescription` is "this is the corrected
text". The key composes them — `fold(cleanDescription(x))` — so both sides of the comparison land on
the corrected text whether or not anyone has run the cleaner. That makes the cleaner's own idempotency
load-bearing: `TYPO_FIXES` must never contain a rule whose output another rule rewrites again, or the
two sides converge on different strings.

Removing the retain block is a deletion, not a rewrite: `buildImportPlan` composes the sheet's tree,
`replaceTreeWithSnapshot` wipes and re-inserts it, and the report's `retained` field flips polarity
from "what we kept" to "what disappears". The five existing tests encode the old behaviour and are
rewritten in the same phase — they are the specification of the thing being removed.

## Critical Implementation Details

- `cleanDescription` must stay free of `server-only` and of any Payload import — `item-key.ts` is
  reached from both the server actions and the pure unit specs.
- `ImportReportT.retained` is consumed by `sheet-import-dialog.tsx` and by the fixture in
  `src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts:26`. Renaming the field
  is a compile error at both sites, which is the point — the rename is what keeps a stale „zostanie
  zachowanych" copy from surviving the deletion.
- The etapy marker is per praca, computed from `currentTree.progress` (`StageProgressT.qtyDone`)
  before the tree is discarded — after `buildImportPlan` returns, that association is gone.
- The reset writes through `replaceTreeWithSnapshot` with `takeSettingsFromTree: false`, so VAT and
  współczynniki are read back off the live investment and the empty tree's `settings` are inert.
- `clearGlobalDiscount: true` on the reset: „Wyczyść" means empty, and a surviving amount discount
  would price the next import below its own total (`globalDiscountAmount` is unclamped — see
  `calc.ts`). This matches `reloadFromPresetAction`, and the dialog copy says it out loud.

---

## Phase 1: Identity key survives a typo fix

### Overview

One composition change in `item-key.ts`, plus the spec that pins it.

### Changes Required

#### 1. `src/lib/kosztorys/sheet-import/item-key.ts`

Run the description through `cleanDescription` before folding, in both `itemKey` and the base key
`keyItems` builds. A comment carrying the _why_: `fold()` is written-form normalization and cannot
absorb a letter-level correction, so a cleaned praca would otherwise stop matching its sheet twin and
be reported as new on both sides.

#### 2. `src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts` (new)

- A praca whose opis differs only by a `TYPO_FIXES` entry keys identically to its uncorrected twin.
- A SHOUTED opis keys identically to its `unshout`ed form.
- Two genuinely different opisy still key apart (the fix must not become a fuzzy matcher).
- Occurrence numbering still separates two identical opisy inside one section.

#### 3. Regression check on the other two consumers

`build-sheet-comparison.test.ts` and `build-measured-qty-refresh.test.ts` must stay green unchanged —
the key change is behaviour-preserving for any praca nobody has cleaned.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts`
- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/`

#### Manual Verification

- On investment 90, run „Popraw literówki w opisie prac", then open „Porównaj z arkuszem Google" — the
  difference must not grow (it stayed 83 before the cleaning run; it grew to 137 after).

---

## Phase 2: The import replaces the whole rozpiska

### Overview

Delete the retain block; flip the report from "what is kept" to "what disappears".

### Changes Required

#### 1. `src/lib/kosztorys/sheet-import/build-import-plan.ts`

- Delete the retain block (lines ~247–290): the `retainedItems` filter, the section create/reuse via
  `sectionIdByName`, the carried progress, and the etap-ordinal trimming that existed only to serve it.
- `RetainedItemT` → `DroppedItemT = { section: string; description: string; hasProgress: boolean }`;
  `ImportReportT.retained` → `dropped`. `hasProgress` is true when any `currentTree.progress` row for
  that item has a non-zero `qtyDone`.
- `matchedCurrentIds` survives — it is what identifies the dropped set.

#### 2. `src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`

Rewrite the five retain tests to assert the drop. They currently read:

| Existing test                                                       | Becomes                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| retains a praca the sheet no longer has, with its own values        | drops it, and reports it under `dropped`                          |
| puts a retained praca last in its section so the sheet's order wins | the tree is exactly the sheet's prace, in the sheet's order       |
| retains a whole section the sheet dropped                           | the section is gone; each of its prace is reported                |
| leaves a retained praca's reference figure alone                    | (deleted — no retained praca exists to have a figure)             |
| drops a retained praca's wykonano for etapy the sheet no longer has | a dropped praca with `qtyDone > 0` is reported with `hasProgress` |

Plus: a praca the sheet still has keeps its wpisane etapy (the replacement must not cost matched
prace their progress — this is the test that makes the deletion safe).

#### 3. `src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts:26`

`retained: []` → `dropped: []`.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`
- [ ] `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/sheet-import-gate.test.ts`
- [ ] `pnpm typecheck` — the field rename must surface every consumer

#### Manual Verification

- Import into an investment holding one praca the sheet doesn't have; confirm it is gone afterwards
  and that „Wersje" holds the labelled pre-import snapshot that brings it back.

---

## Phase 3: The preview says what disappears

### Overview

`RetainedBlock` currently reassures; it must warn.

### Changes Required

#### 1. `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx`

`RetainedBlock` → `DroppedBlock`, fed `report.dropped`:

- Empty: unchanged reassurance — the sheet covers the whole rozpiska.
- Non-empty: „X prac zniknie — arkusz ich nie ma. Stan sprzed importu zapisze się automatycznie —
  wrócisz do niego przez „Wczytaj"." Prace carrying wpisane etapy are called out separately, since
  those are the ones where the loss is more than text.
- Fold summary: „Zobacz, które prace znikną (X)".

#### 2. `src/components/kosztorys/editor/dialogs/sheet-report-parts.tsx`

`ItemList` takes an optional per-item marker so a praca with wpisane etapy is visibly distinct in the
list. Keep it a rendering detail of the shared component — the other `ItemList` call sites pass
nothing and are unaffected.

### Success Criteria

#### Automated Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`

#### Manual Verification

- Preview an import against an investment with prace outside the sheet, one of them with wpisane
  etapy: the count, the wording and the etapy marker must all be right before anything is written.

---

## Phase 4: „Wyczyść kosztorys"

### Overview

A fourth caller of `replaceTreeWithSnapshot`, with an empty tree.

### Changes Required

#### 1. `src/lib/actions/kosztorys.ts`

`clearKosztorysAction(investmentId)` through `protectedAction`, same auth posture as
`cleanItemDescriptionsAction`. Calls `replaceTreeWithSnapshot` with an empty
`SnapshotPayloadT` (no sections, items, stages, progress), `label: 'Przed wyczyszczeniem'`,
`clearGlobalDiscount: true`, `takeSettingsFromTree: false`. Revalidates the same tags the import does.

#### 2. `src/components/kosztorys/editor/dialogs/clear-kosztorys-dialog.tsx` (new)

A confirm dialog, not a bare menu click — this is the one action in the menu that leaves nothing
behind. Copy states plainly: cała rozpiska razem z etapami i wpisanym wykonaniem znika, stawka VAT i
współczynniki zostają, rabat globalny zostaje wyzerowany, stan sprzed zapisze się automatycznie.
Shows the current sekcje/prace counts so the owner sees what they are about to delete. Confirm →
action → `onTreeReplaced?.()`.

#### 3. `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

Menu entry in the Edycja group, below „Popraw literówki", `variant="destructive"`, with
`MenuItemBody({ label: 'Wyczyść kosztorys', description: 'Usuwa całą rozpiskę. Stan sprzed zapisze się w „Wersje".' })`.
The dialog is a controlled sibling of the menu, per the existing note about Radix focus.

### Success Criteria

#### Automated Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`

#### Manual Verification

- Clear a seeded investment: grid empties without a reload, „Wersje" holds „Przed wyczyszczeniem",
  restoring it brings the rozpiska back whole (etapy and wykonanie included), and VAT/współczynniki
  are untouched throughout.

---

## Phase 5: Sweep investment 90

### Overview

No code. Discharged by the two features above.

### Steps

1. „Wyczyść kosztorys" on investment 90.
2. „Pobierz z arkusza Google" — full import.
3. „Porównaj z arkuszem Google" reads **373 / 373 / 0**.

### Success Criteria

#### Manual Verification

- The compare dialog shows zero difference, and the row count in the grid is 373, not 456.

---

## Testing Strategy

### Unit Tests

Everything that matters here is a pure function. The key fix is a table of opis pairs; the retain
removal is the five rewritten `build-import-plan` cases plus the new "a matched praca keeps its
wpisane etapy" case, which is the actual risk the deletion introduces.

### Integration Tests

None. `replaceTreeWithSnapshot` is unchanged — the reset is a new caller of a path already exercised
by the import and the preset reload.

### Manual Testing Steps

Per phase above; Phase 5 is the end-to-end check that closes the original report.

## Migration Notes

No schema change, no migration, nothing to backfill.

## Whole-tree Gate

Run once, after Phase 4.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change identity and the measured evidence: `context/changes/2026-08-19-import-zastepuje-w-calosci/change.md`
- Identity key: `src/lib/kosztorys/sheet-import/item-key.ts`, `columns.ts` (`fold`)
- Retain block: `src/lib/kosztorys/sheet-import/build-import-plan.ts:247`
- Preview copy: `src/components/kosztorys/editor/dialogs/sheet-import-dialog.tsx:214`
- Wholesale replacement contract: `src/lib/kosztorys/replace-tree-with-snapshot.ts`
- Confirm-dialog + copy precedent: `src/components/kosztorys/editor/dialogs/reload-from-preset-dialog.tsx`
- Menu + remount pattern: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx:82`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Identity key survives a typo fix

#### Automated

- [x] 1.1 `item-key` spec passes — d371c62a
- [x] 1.2 The whole `sheet-import` spec directory still passes — d371c62a

### Phase 2: The import replaces the whole rozpiska

#### Automated

- [x] 2.1 `build-import-plan` spec passes with the rewritten drop cases — 0b4daa86
- [x] 2.2 `sheet-import-gate` spec passes — 0b4daa86
- [x] 2.3 `pnpm typecheck` clean after the `retained` → `dropped` rename — 0b4daa86

### Phase 3: The preview says what disappears

#### Automated

- [x] 3.1 `pnpm typecheck` and `pnpm lint` clean — 0b4daa86

### Phase 4: „Wyczyść kosztorys"

#### Automated

- [ ] 4.1 `pnpm typecheck` and `pnpm lint` clean

### Phase 5: Sweep investment 90

#### Automated

- [ ] 5.1 (none — manual verification only)
