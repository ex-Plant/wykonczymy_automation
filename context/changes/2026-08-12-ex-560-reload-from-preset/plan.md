# Reload a kosztorys from a preset — Implementation Plan

## Overview

Give the editor a „Wczytaj szablon…" action that **replaces** an investment's whole rozpiska with a
preset, reversibly. Today a preset can only reach an investment at creation time (`presetId` on the
create form) or section-by-section as an **append** (`appendPresetSectionsAction`) — once
`kosztorys_sections` holds a single row, `seedInvestmentFromPreset` returns `'not-empty'` and refuses.
So picking the wrong szablon at creation is unrecoverable without deleting rows by hand.

The destructive-but-reversible mechanism already exists and is in production: `applyKosztorysImport`
takes a forced pre-wipe `manual` snapshot and calls `restoreKosztorys` inside ONE transaction. This
change ports that shape onto a preset payload.

## The use case this serves (owner, 2026-08-12)

**Swapping the szablon at the start of an investment.** A fresh job, a little entered by hand, the
wrong szablon picked or none picked — start over. That is the whole scope.

An earlier draft of this plan tried to make the reload safe on a _mature_ rozpiska by matching prace
across the swap and carrying przedmiar and postęp over. **The owner rejected that as
over-engineering**: reloading a szablon onto a kosztorys with real work recorded against it makes no
business sense in the first place, so building a merge to protect that case buys complexity and
nothing else. This plan is the plain replacement.

## Current State Analysis

| Piece                    | Where                                                              | State                                                                                                 |
| ------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Reversible wipe+insert   | `src/lib/kosztorys/restore-kosztorys.ts`                           | Exists. Caller owns the transaction; rewrites investment settings from the payload it is handed.      |
| Forced pre-wipe snapshot | `src/lib/actions/kosztorys-import.ts:120-134`                      | Exists. `kind: 'manual'` + a label, so it is exempt from the 50-row cap and the 7-day sweep.          |
| Insert-only preset apply | `src/lib/kosztorys/apply-preset.ts`                                | Exists, but **no wipe** — it documents that the caller guarantees an empty target.                    |
| Preset payload shape     | `src/lib/kosztorys/serialize-preset.ts`                            | A `SnapshotPayloadT` with the job-specific fields zeroed and `stages`/`progress` emptied.             |
| Preset picker control    | `src/components/forms/investment-form/investment-form.tsx:116-131` | A plain `<Select>` of preset names. **This is the control to reuse** — no new picker UI is warranted. |
| Per-preset counts        | `getPresetSections()` → `PresetSectionMetaT`                       | Already fetched by the section picker; gives „co wejdzie" with no new query.                          |
| Post-replace refresh     | `onTreeReplaced` on the editor context                             | Exists; the sheet import already calls it.                                                            |

### Key Discoveries

- **`restoreKosztorys` needs no `wipe` variant.** It rewrites investment settings from
  `payload.settings`; handing it `settings: currentTree.settings` makes that write a no-op — exactly
  what `buildImportPlan` does (`build-import-plan.ts:277`). So the reload reuses the restore path
  whole, and the "preset must not carry another job's VAT/coeffs" rule from `apply-preset.ts` is
  preserved without a second code path.
- **`applyPreset` is NOT the right callee here.** It is insert-only by contract. Reusing
  `restoreKosztorys` instead keeps one atomic wipe+insert in the codebase rather than two.
- **The preset payload is already a valid tree.** With no merge to perform, the only transformation
  is swapping in the current tree's `settings`. There is no id remapping, no matching, no ordinal
  juggling — none of what `buildImportPlan` does.
- **The cache-tag list is already duplicated** — `IMPORT_TAGS` (`kosztorys-import.ts:22`) and an
  inline copy in `kosztorys-snapshots.ts:91`, with a comment asking them to stay identical. A third
  copy is not acceptable; Phase 1 extracts it.
- **Stale comment found**: `serialize-preset.ts:23` claims "The seed installs one fresh blank etap on
  the target instead" — `seed-from-preset.ts:35-38` deliberately installs none. Fix in passing.

## Desired End State

From the kosztorys editor's „Opcje" menu, „Wczytaj szablon…" opens a dialog with the same preset
dropdown the create-investment form uses. It says plainly how much disappears and how much arrives,
and confirming replaces the whole rozpiska in one atomic step, leaving a named restore point in
„Wczytaj".

Verified by an integration spec that reloads onto a populated investment and asserts the
**persisted** tree is the preset's, the investment's settings are unchanged, and the pre-reload
snapshot restores the original tree.

## Owner Rulings (2026-08-12) — decided, not open

1. **The preset stays a separate fast path** next to the sheet import. Case: a fresh investment,
   start over without setting up a sheet.
2. **"Effectively empty" detection is rejected.** With a reversible wipe there is no reason to
   distinguish a stub from a real rozpiska — one path covers both, and no gate blocks the action.
3. **Settings survive.** VAT, coefficients and the global discount are untouched.
4. **Everything else goes.** Sekcje, prace, przedmiar, etapy and recorded postęp are replaced by the
   szablon's content. No matching, no carry-over — see "The use case this serves" above for why the
   merge design was dropped.
5. **No escalated confirmation.** One dialog with counts, like the sheet import — the move is fully
   reversible.

## What We're NOT Doing

- **No praca matching across the swap.** Nothing is carried over. This is the ruling that shrank the
  plan from four phases to three.
- **Not touching the `'not-empty'` guard** in `seedInvestmentFromPreset` — that is the
  investment-creation path and stays refusing.
- **Not gating the action** on how much work is recorded. Ruling 2.
- **Not section-granular replace.** Whole szablon or nothing; partial work stays with the existing
  „Dodaj sekcję z szablonu".
- **No new migration.** Nothing schema-level changes.

## Implementation Approach

Reuse over reinvention at every seam: the sheet import's atomic snapshot→wipe→insert shape,
`restoreKosztorys` itself, and the create-form's preset `<Select>`. With the merge dropped there is
essentially no new domain logic — the work is one server action and one dialog.

## Critical Implementation Details

**Snapshot ordering inside the transaction.** The snapshot must be captured on the transaction handle
and BEFORE the wipe. Outside the transaction, a rollback leaves an orphan snapshot behind; after the
wipe it snapshots an empty tree. `kosztorys-import.ts:99-102` documents this; the same ordering is
load-bearing here.

**Snapshot kind must be `manual`, not `auto`.** An `auto` row is ambient history — capped at the
newest 50 and swept after 7 days. Only a labelled `manual` row survives as a targetable entry in
„Wczytaj", which is the entire reversibility guarantee.

**The preset id is resolved server-side.** The client sends an id, never tree data, so a forged
payload cannot decide what gets written — same reason `applyKosztorysImport` re-reads the sheet
instead of trusting its own preview.

---

## Phase 1: Dedup the cache-tag list

### Overview

`IMPORT_TAGS` and the inline array in `kosztorys-snapshots.ts:91` are the same five tags with a
comment asking them to stay identical. Phase 2 would add a third copy. Behavior-neutral.

### Changes Required

#### 1. One shared constant

**File**: `src/lib/cache/` (co-locate with the existing tag helpers; confirm the exact file at
implementation time)

**Intent**: A single exported list of the tags a whole-tree replacement invalidates, so the three
call sites cannot drift.

**Contract**: One exported readonly tuple — the four tree tags plus `investments` (`restoreKosztorys`
rewrites the investment row regardless, which is why it belongs) — consumed by
`applyKosztorysImport`, `restoreSnapshotAction`, and the new action. Keep the explanatory comment
from `kosztorys-import.ts:19-21`; it is the reason `investments` is in the list.

### Success Criteria

#### Automated Verification:

- Type checking passes: `pnpm typecheck`

#### Manual Verification:

- None — behavior-neutral extraction.

---

## Phase 2: The action

### Overview

The whole feature server-side: resolve the preset, snapshot, replace, atomically.

### Changes Required

#### 1. The action

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: „Wczytaj szablon" end to end. Loads the preset payload by id, swaps in the current tree's
`settings` so the restore's settings write-back is a no-op, then in ONE transaction inserts the
forced pre-reload `manual` snapshot and calls `restoreKosztorys`.

**Contract**:
`reloadFromPresetAction(investmentId: number, presetId: number): Promise<ActionResultT<{ sections: number; items: number }>>`.
Zod-validated ids via `validateAction`. Unknown preset → `{ success: false }` with nothing written.
Snapshot label: `'Przed wczytaniem szablonu'`. Revalidates the Phase-1 tag list.

#### 2. The reversibility spec

**File**: `src/__tests__/lib/actions/kosztorys-presets.test.ts`

**Intent**: The one risk that matters on a destructive path — that the promised undo is real. Asserts
**persisted state**, never the action's return value: a success result can hide a failed write.

**Contract**: Seed an investment with sekcje, prace (typed przedmiar), etapy and postęp; reload from a
preset; assert the DB tree is the preset's content with none of the old rows surviving, and that VAT
and the coefficients are unchanged; then restore the auto-created snapshot and assert the original
tree — including etapy and postęp — is back. Plus: a failing reload (unknown preset id) leaves the
live tree untouched and writes no snapshot.

### Success Criteria

#### Automated Verification:

- Reversibility spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts`
- The DB-backed suite still passes: `pnpm test:integration`

#### Manual Verification:

- After a reload, „Wczytaj" lists „Przed wczytaniem szablonu" and restoring it brings back the
  original rozpiska including etapy and postęp.

---

## Phase 3: Dialog and menu entry

### Overview

The smallest UI that makes a destructive action legible: the create-form's preset dropdown, the two
counts, one confirm.

### Changes Required

#### 1. The dialog

**File**: `src/components/kosztorys/editor/dialogs/reload-from-preset-dialog.tsx` (new)

**Intent**: Pick a szablon and confirm the replacement. Fetch-on-open via `listPresetSectionsAction`
(the section metas already carry per-preset sekcja and praca counts, so „co wejdzie" needs no new
query and no new endpoint). „Co zniknie" is counted from the editor context's `tree`. The description
names what goes — the whole rozpiska including etapy and wpisane wykonano — and that the previous
state saves itself into „Wczytaj".

**Contract**: Props mirror `SheetImportDialog` (`investmentId`, `open`, `onOpenChange`, `onReloaded`).
Confirm disabled until a szablon is chosen or while pending. Fetch-on-open must handle the
close-then-reopen race the way `AddSectionsFromPresetDialog:69-91` does (a `stale` flag), and a
transport-level rejection must not hang the loading state.

#### 2. Menu entry

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: „Wczytaj szablon…" next to „Pobierz z arkusza Google…" — both are whole-tree replacements,
so they belong in the same group, separated from the append-flavoured „Zapisz jako szablon…".

**Contract**: A `DropdownMenuItem` with `MenuItemBody`, description naming the destructive effect
(„Zastąp całą rozpiskę zapisanym szablonem"). Dialog rendered as a controlled sibling of the menu, not
a child of `DropdownMenuContent`. `onReloaded` calls `onTreeReplaced`.

#### 3. Stale comment

**File**: `src/lib/kosztorys/serialize-preset.ts`

**Intent**: Line 23 claims the seed installs a blank etap; it installs none. Correct it while the file
is in scope.

**Contract**: Comment text only.

### Success Criteria

#### Automated Verification:

- No phase-scoped automated check. This phase is dialog wiring over logic already pinned in Phase 2;
  its risk is browser-level and is covered by the E2E disposition below, not by a unit spec.

#### Manual Verification:

- „Wczytaj szablon…" appears in „Opcje" and lists saved szablony.
- The dialog states how many sekcje and prace disappear and how many arrive.
- Confirming replaces the rozpiska; the grid shows the new content without a manual refresh.
- VAT, the coefficients and the global discount are the same afterwards.
- „Wczytaj" offers „Przed wczytaniem szablonu" and restoring it brings everything back.
- Reloading an investment with an empty kosztorys works too (no special-casing).

---

## Testing Strategy

**Risk-anchored, per `context/foundation/test-plan.md`.** With the merge dropped, exactly one risk
justifies automation: _the promised undo does not actually restore_. Phase 2's integration spec
asserts persisted state on both sides of the round trip. Everything else (menu placement, dialog
copy, count rendering) is browser-level and does not earn a unit test.

**E2E disposition**: this slice is browser-level, so it owes an E2E. Author it at the review gate or
file it into the E2E backlog (a Linear issue labelled `e2e-backlog` in project "Wykonczymy"); the
review gate blocks archive until one or the other has happened. Candidate spec: reload from a szablon
onto a seeded investment, assert the grid content changed and the restore point is listed.

## Migration Notes

None. No schema change, and per `AGENTS.md` kosztorys rows are throwaway until dogfooding merges to
`main`, so no data-preservation path is owed.

## Whole-tree Gate

Run **once**, after Phase 3.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Ported pattern: `src/lib/actions/kosztorys-import.ts:98-148`
- Atomic wipe+insert: `src/lib/kosztorys/restore-kosztorys.ts`
- Preset field to reuse: `src/components/forms/investment-form/investment-form.tsx:116-131`
- Linear: EX-560

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Dedup the cache-tag list

#### Automated

- [x] 1.1 Typecheck passes — d0bed5d7

### Phase 2: The action

#### Automated

- [x] 2.1 Reversibility spec passes — 13d4bf91
- [x] 2.2 DB-backed integration suite passes — 13d4bf91

### Phase 3: Dialog and menu entry

#### Automated

- [x] 3.1 No phase-scoped automated check (browser-level; E2E disposition in Testing Strategy)

### Whole-tree Gate

- [x] `pnpm typecheck`
- [x] `pnpm lint` (0 errors; pre-existing warnings only)
- [x] `pnpm test` — 2107 passed, 96 skipped
- [x] `pnpm build`
