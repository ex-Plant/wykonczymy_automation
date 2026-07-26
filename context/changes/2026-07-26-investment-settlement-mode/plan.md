# Investment Settlement Mode Implementation Plan

## Overview

Store how an investment is settled — `NET` / `GROSS` / `MIXED` — on the investment itself, and make
that stored value the only source of truth for the money axis of the Podsumowanie panel **and** of the
client view's grid columns. Today the pick lives in the reader's `localStorage`, so the same
investment reads netto for one person and brutto for another, and a client reads whatever the owner's
browser last remembered.

## Current State Analysis

- **No persisted settlement decision exists.** `src/collections/investments.ts` stores `vatRate`,
  `globalDiscountType/Value` and the two subcontractor coefficients — nothing about netto/brutto.
- **The panel's axis is a browser preference.** `src/components/kosztorys/summary/hooks/use-summary-axis.ts`
  persists `net` / `gross` / `mixed` under `table-columns:kosztorys-summary-axis` via
  `usePersistedEnum`. `PanelAxisT` extends `MoneyAxisT` with the panel-only `mixed`.
- **The only persisted trace of the distinction is per-transaction**: `vatPlane` (`NET` / `GROSS`) on
  an `INVESTOR_DEPOSIT` (`src/collections/transfers.ts:142`). `bucketDepositsByPlane`
  (`src/lib/kosztorys/summary-economics.ts:193`) splits deposits by it, with the owner's ruling that
  unmarked/`null` counts as netto (flipped 2026-07-22).
- **The client view currently hides the control but not its effect** (commit `64aa2721`): the select is
  suppressed under `clientView`, so the client silently reads the owner's `localStorage` value. The
  client header also carries a Netto/Brutto grid toggle added in `ee0667fb`
  (`src/components/kosztorys/editor/grid/money-axis-toggle.tsx` + `toClientAxis` in
  `src/lib/kosztorys/money-axis.ts`), which lets the client pick a grid axis independently of the
  panel — the split this change removes.
- **A precedent for the whole vertical already exists in `vatRate`**: stored on the investment,
  denormalized onto the tree at `src/lib/queries/kosztorys.ts:150`, typed on `KosztorysTreeT`
  (`src/lib/kosztorys/types.ts:171`), written by `updateInvestmentVatAction`
  (`src/lib/actions/kosztorys.ts:130`), and edited from the kosztorys editor rather than the
  investment form.
- **A scream pattern for "the two planes disagree" already exists**: `ReconT` / `reconciliationTooltip`
  / `buildKosztorysReconciliation` in `src/lib/kosztorys/reconciliation.ts`, rendered by the panel and
  suppressed for `clientView`.
- **Payload `select` fields map to pg enums**, never varchar. Migrations are hand-written here
  (`migrate:create` emits phantom drift); the template to copy is
  `src/migrations/20260724_2_add_plane_to_kosztorys_stages.ts`.

## Desired End State

An investment carries `settlementMode`. The owner sets it from the Podsumowanie panel — the same select
that is there today, now writing to the investment instead of `localStorage`. Every reader of that
investment, owner or client, sees the same money plane in the panel _and_ in the grid; the client has
no control over it and no way to read a different plane than the panel shows. A deposit whose
`vatPlane` contradicts the mode still records normally but raises an owner-only mismatch warning in
the panel. `MIXED` shows the client the full invoiced/cash split.

Verify by: setting the mode as owner, reloading `/podglad-klienta/<id>` in a browser with a _different_
`localStorage` (or cleared), and seeing the same plane in both surfaces.

### Key Discoveries:

- `vatRate` is a complete, working template for "an investment-level figure edited from the kosztorys
  editor" — field → migration → tree denormalization → action → cache tags (`src/lib/actions/kosztorys.ts:130`).
- The tree is the transport both pages already share: the owner page and
  `getClientKosztorysPreview` (`src/lib/queries/client-kosztorys.ts`) both build
  `KosztorysEditorDataT`, so a field on `KosztorysTreeT` reaches the client view for free.
- `MoneyAxisT` has no `mixed`; `PanelAxisT` does. The stored mode is closer to `PanelAxisT`, so the
  grid needs a documented projection (`MIXED` → both money columns), not a shared type.
- `bucketDepositsByPlane` already carries the null→netto ruling, so the mismatch check must reuse it
  rather than re-reading `vatPlane` and risking a second, contradictory interpretation.

## What We're NOT Doing

- Not adding the field to the investment form UI — the panel is the only edit surface (owner's call).
- Not backfilling per-investment values from deposit history — every existing investment starts `NET`.
- Not blocking or rejecting a deposit whose plane contradicts the mode; it records and screams.
- Not touching `useMoneyAxis` for the owner's grid (the „Kwoty" control in the Widok menu) — that stays
  a per-person column-visibility preference on the owner's side.
- Not making `MIXED` a derived state; it is a mode the owner picks.
- Not adding an E2E spec in this change (unit coverage only — see Testing Strategy).

## Implementation Approach

Follow the `vatRate` vertical end to end, then delete the `localStorage` layer it replaces. Order
matters: the field and its transport land first (Phase 1) so the panel has something to read before
its own state is removed (Phase 2); the client's independent axis is removed only once the stored mode
is actually driving figures (Phase 3); the mismatch verdict is additive and last (Phase 4).

## Critical Implementation Details

**State sequencing.** Phase 2 deletes `use-summary-axis.ts`, whose value currently also feeds
`nettoShown` → the Wydatki tab's netto-pricing controls, and `displayAxis` → the Robocizna tab. Both
must be re-pointed at the stored mode in the same phase, or the panel loses its axis mid-change.

**Migration is deploy-gated, not phase-gated.** Write and apply the migration locally in Phase 1;
`pnpm db:migrate:prod` is a human step owed only when this ships. Do not mark a phase blocked on it.

---

## Phase 1: Store the mode on the investment

### Overview

The field, its enum, and its ride onto the kosztorys tree — no UI, no behavior change yet.

### Changes Required:

#### 1. Collection field

**File**: `src/collections/investments.ts`

**Intent**: Record how the investment is settled, next to `vatRate` — the same family of "how we
compute this investment" settings, and the same story about being edited from the kosztorys editor.

**Contract**: `settlementMode`, `type: 'select'`, options `NET` / `GROSS` / `MIXED` with Polish labels
(„Netto" / „Brutto" / „Mieszane"), `defaultValue: 'NET'`, required. Payload maps this to
`enum_investments_settlement_mode`.

#### 2. Migration

**File**: `src/migrations/20260726_3_add_settlement_mode_to_investments.ts` (+ register in
`src/migrations/index.ts`)

**Intent**: Add the enum and the column, defaulted so no existing investment lands in a null state —
every current investment reads netto until the owner says otherwise.

**Contract**: `CREATE TYPE … AS ENUM('NET','GROSS','MIXED')` guarded by the `duplicate_object`
`DO $$` block used by the sibling migrations; `ADD COLUMN IF NOT EXISTS "settlement_mode"` NOT NULL
DEFAULT `'NET'`. `down()` drops column then type.

#### 3. Tree transport

**Files**: `src/lib/kosztorys/types.ts`, `src/lib/queries/kosztorys.ts`

**Intent**: Carry the mode to every surface that renders a kosztorys, exactly as `vatRate` travels, so
the owner page and the client preview can't diverge in how they obtain it.

**Contract**: `settlementMode: SettlementModeT` on `KosztorysTreeT`, populated beside
`vatRate: investment.vatRate ?? DEFAULT_VAT` (`src/lib/queries/kosztorys.ts:150`). `SettlementModeT`
(`'NET' | 'GROSS' | 'MIXED'`) plus its `PanelAxisT` projection live in
`src/lib/kosztorys/money-axis.ts` — that module already owns the axis vocabulary.

### Success Criteria:

#### Automated Verification:

- Types regenerate with the new field: `pnpm generate:types`
- Type checking passes: `pnpm exec tsc --noEmit`
- Migration applies against the local docker DB: `pnpm payload migrate`
- Existing unit suite passes: `pnpm test`

#### Manual Verification:

- The field is visible and editable on an investment in the Payload admin panel.
- An existing investment (e.g. the seeded dogfooding one) reads „Netto" rather than empty.

---

## Phase 2: The owner writes it; localStorage goes away

### Overview

The panel's select becomes the investment's editor. The browser-persisted axis is deleted, not
layered on top.

### Changes Required:

#### 1. Server action

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Persist the owner's pick through the standard mutation path, invalidating the same cached
readers `updateInvestmentVatAction` does.

**Contract**: `updateInvestmentSettlementModeAction(investmentId: number, mode: SettlementModeT)`
built on `protectedAction`, validated by a Zod enum schema, revalidating `['investments']` (the mode
is not denormalized onto items, unlike `vatRate`, so `kosztorysItems` is not owed).

#### 2. Panel reads and writes the stored mode

**Files**: `src/components/kosztorys/summary/kosztorys-totals-panel.tsx`,
`src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: The select shows the investment's mode and saves on change; every figure in the panel
derives from that value. The panel stops owning axis state.

**Contract**: new props `settlementMode: SettlementModeT` and `onSettlementModeChange?: (mode) => void`
(absent under `clientView`, mirroring how `handlers` gates the section band). `moneyAxis` becomes the
`PanelAxisT` projection of the prop; `displayAxis` and `nettoShown` derive from it unchanged. The body
passes `tree.settlementMode` and, outside `clientView`, a handler calling the action.

#### 3. Delete the persisted axis

**File**: `src/components/kosztorys/summary/hooks/use-summary-axis.ts` (deleted)

**Intent**: Remove the second source of truth outright — with the mode stored, a per-person override is
the ambiguity that caused this change.

**Contract**: `PanelAxisT` and `SUMMARY_AXIS_DEFAULT` move to / stay in `src/lib/kosztorys/money-axis.ts`;
the `table-columns:kosztorys-summary-axis` key is abandoned (no migration of stored values — it is a
reading preference, not data).

#### 4. Unit test: the stored mode decides

**File**: `src/__tests__/lib/kosztorys/settlement-mode.test.ts`

**Intent**: Lock the projection rule that the whole change rests on, at the pure-function layer.

**Contract**: asserts `NET → 'net'`, `GROSS → 'gross'`, `MIXED → 'mixed'` (panel) and that the grid
projection maps `MIXED` to both money columns.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-mode.test.ts`
- No reference to the removed hook remains: `! grep -rn "use-summary-axis" src`
- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`

#### Manual Verification:

- Owner switches the mode in the panel; the figures change and the pick survives a hard reload.
- The same investment opened in a second browser profile shows the owner's stored mode, not that
  profile's old `localStorage` value.

---

## Phase 3: The client reads it — one plane, no controls

### Overview

The stored mode drives the client's grid columns too, so the Netto/Brutto toggle in the client header
is removed. `MIXED` shows the client the full invoiced/cash split.

### Changes Required:

#### 1. Drop the client's own axis control

**Files**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/grid/money-axis-toggle.tsx` (deleted),
`src/lib/kosztorys/money-axis.ts`

**Intent**: A client who can pick a grid axis can make the table disagree with the panel. The mode now
answers for both, so the control has no reason to exist.

**Contract**: the `clientView` header keeps the investment name and the Podsumowanie toggle only.
`MoneyAxisToggle`, `ClientMoneyAxisT` and `toClientAxis` are removed (all three were added this week
for this header and have no other caller — verify with grep before deleting).

#### 2. Grid columns follow the mode in the client view

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: The client's money columns come from the investment, not from a persisted per-person axis.

**Contract**: in `clientView`, `effectiveMoneyAxis` is the grid projection of `tree.settlementMode`
(`NET → 'net'`, `GROSS → 'gross'`, `MIXED → 'both'`); the non-client branches are untouched, so the
owner's „Kwoty" preference and the net-locked subcontractor views keep their current behavior.

#### 3. `MIXED` shows the client the split

**File**: `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx` (verify current gating)

**Intent**: For a mixed-settled client the split _is_ the settlement — the invoiced part, the cash
part, and which deposits paid which. The panel already renders this for the owner; confirm no
`clientView` gate withholds it.

**Contract**: the mixed-mode blocks (`paidNet` / `paidGross` sections and the gotówka block) render
under `clientView`; only the reconciliation scream and internal links stay owner-only.

### Success Criteria:

#### Automated Verification:

- Deleted primitives have no remaining callers: `! grep -rn "MoneyAxisToggle\|toClientAxis" src`
- Type checking passes: `pnpm exec tsc --noEmit`
- Existing unit suite passes: `pnpm test`

#### Manual Verification:

- Client view shows exactly one money plane in the grid, matching the panel, with no axis control.
- With the mode set to „Mieszane", the client sees both parts and their deposits.
- The client view still fills the viewport with no dead band at the bottom (guards the `h-dvh` fix
  from `7b70ec2a`, whose header this phase edits).

---

## Phase 4: Scream when a deposit contradicts the mode

### Overview

An owner-only warning in the panel when a deposit's plane can't belong to the declared mode.

### Changes Required:

#### 1. The verdict

**File**: `src/lib/kosztorys/reconciliation.ts`

**Intent**: Name the disagreement as data, alongside the existing robocizna/rabat verdict, so the
panel renders it rather than deciding it — and so the parity/unit tests exercise the same function the
UI does.

**Contract**: `buildSettlementPlaneVerdict({ mode, paidNet, paidGross })` returning
`{ mismatch: boolean; mode: SettlementModeT; offendingAmount: number }`. Rules: `NET` — any
`paidGross > 0` offends; `GROSS` — any `paidNet > 0` offends (`paidNet` already absorbs unmarked
deposits per the null→netto ruling); `MIXED` — never offends. Sums come from `bucketDepositsByPlane`,
never from a second read of `vatPlane`.

#### 2. Render it, owner-only

**File**: `src/components/kosztorys/summary/tabs/summary-overview-tab.tsx`

**Intent**: Put the warning where the existing mismatch scream lives, with the same affordance, so the
owner has one place to look for "the two sides disagree".

**Contract**: reuses the existing scream component/badge and the `clientView` suppression already
applied to `reconciliation`; tooltip names the declared mode and the offending amount.

#### 3. Unit test: the rule fires and clears

**File**: `src/__tests__/lib/kosztorys/settlement-mode.test.ts` (extends Phase 2's spec)

**Intent**: The mismatch rule is the one piece of new business logic in this change.

**Contract**: `NET` + gross deposit → mismatch; `NET` + only net/unmarked → clean; `GROSS` + net
deposit → mismatch; `MIXED` + both → clean; no deposits → clean in every mode.

### Success Criteria:

#### Automated Verification:

- Spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-mode.test.ts`
- Type checking passes: `pnpm exec tsc --noEmit`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- A gross deposit on a netto-declared investment raises the warning in the panel.
- The client view of that same investment shows no warning.

---

## Testing Strategy

### Unit Tests:

- The mode → panel-axis and mode → grid-axis projections (including `MIXED` → both columns).
- The plane-mismatch verdict across all three modes, with and without deposits, including the
  unmarked-deposit-counts-as-netto ruling.

### Integration Tests:

None owed. The change adds no new query or SQL path — the field rides the existing tree read, which
the parity fixture already covers.

### Manual Testing Steps:

1. Set the mode to „Brutto" as owner; confirm the panel and grid both switch.
2. Open `/podglad-klienta/<id>` with cleared `localStorage`; confirm the same plane and no axis control.
3. Set „Mieszane"; confirm the client sees both parts and their deposits.
4. Add a gross deposit to a netto-declared investment; confirm the owner-only warning.

## Performance Considerations

None. One enum column read on an already-fetched investment row; no new query, no new N+1 surface.

## Migration Notes

Hand-written per repo rule. `NOT NULL DEFAULT 'NET'` means the backfill is the default — no data step.
`pnpm db:migrate:prod` is a human step owed when this ships, not during implementation. The abandoned
`table-columns:kosztorys-summary-axis` localStorage key needs no cleanup; it simply stops being read.

## References

- Change identity: `context/changes/2026-07-26-investment-settlement-mode/change.md`
- Template vertical (`vatRate`): `src/lib/actions/kosztorys.ts:130`, `src/lib/queries/kosztorys.ts:150`
- Migration template: `src/migrations/20260724_2_add_plane_to_kosztorys_stages.ts`
- Scream pattern: `src/lib/kosztorys/reconciliation.ts`
- Immediate trigger: commits `7b70ec2a`, `ee0667fb`, `64aa2721`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Store the mode on the investment

#### Automated

- [x] 1.1 Types regenerate with the new field: `pnpm generate:types`
- [x] 1.2 Type checking passes: `pnpm exec tsc --noEmit`
- [x] 1.3 Migration applies against the local docker DB: `pnpm payload migrate`
- [x] 1.4 Existing unit suite passes: `pnpm test`

### Phase 2: The owner writes it; localStorage goes away

#### Automated

- [ ] 2.1 New spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-mode.test.ts`
- [ ] 2.2 No reference to the removed hook remains: `! grep -rn "use-summary-axis" src`
- [ ] 2.3 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 2.4 Lint passes: `pnpm lint`

### Phase 3: The client reads it — one plane, no controls

#### Automated

- [ ] 3.1 Deleted primitives have no remaining callers: `! grep -rn "MoneyAxisToggle\|toClientAxis" src`
- [ ] 3.2 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 3.3 Existing unit suite passes: `pnpm test`

### Phase 4: Scream when a deposit contradicts the mode

#### Automated

- [ ] 4.1 Spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-mode.test.ts`
- [ ] 4.2 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 4.3 Full unit suite passes: `pnpm test`
