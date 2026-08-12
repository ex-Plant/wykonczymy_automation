# EX-557 — Investment-less deposits Implementation Plan

## Overview

Restore `OTHER_DEPOSIT` („Inna wpłata") to the deposit dialog, and make the rule "neither
`OTHER_DEPOSIT` nor `COMPANY_FUNDING` may ever carry an investment" structural — enforced by a
predicate on the server, not by a JSX literal in one form. The three grandfathered rows
(`id=1171`, `1196`, `1381`) keep their stored `investment_id` untouched.

## Current State Analysis

- `DEPOSIT_UI_TYPES` (`src/lib/constants/transfers.ts:271`) lost `OTHER_DEPOSIT` in commit
  `72ddc5d7` (2026-07-21) — one day after row `id=3898` was created with it. Since then, cash
  entering a register **without** an investment has had no type a manager can book it under.
- `INVESTMENT_TYPES` (`:420-431`) still contains both deposit types, so `showsInvestment` is true
  for them. Consequence: the edit dialog (`edit-transfer-form.tsx:153`) and the Payload admin
  (`collections/transfers.ts:183`) both offer an investment picker, and the validate hook waves it
  through.
- The deposit form leaks an investment even while hiding the field: `deposit-form.tsx:79` seeds
  `investment: investmentFromUrl` into `defaultValues`, the type-change listener (`:112-116`)
  resets _to that default_, the picker is gated on a JSX literal (`:132`), and `toData` (`:100`)
  still submits it. A deposit added from `/inwestycje/<id>` therefore carries that investment.
  Same shape for `vatPlane`: defaulted at `:77`, never reset, hidden at `:147`, submitted at `:98`.
- `validate.ts:75-77` clears `investment` unconditionally (`d.investment = null`) on every write,
  create and update alike, and `originalDoc` is never consulted for that field. So merely narrowing
  `INVESTMENT_TYPES` would wipe the three grandfathered rows on their first unrelated edit —
  including an invoice-only edit via `setTransferInvoices` (`src/lib/actions/transfers.ts:311-315`).
- The zod layer has no "must NOT have an investment" rule at all
  (`src/lib/schemas/transfer-validation.ts:31-64`).

Full evidence: `research.md`.

## Desired End State

- „Inna wpłata" is selectable in the deposit dialog for every role that can reach the dialog;
  „Zasilenie z konta firmowego" stays ADMIN/OWNER-only (client-side gate, per ruling 6).
- No server path — action, REST, GraphQL, admin panel, script — can write an investment onto either
  type. New rows always land with `investment_id IS NULL`.
- Rows 1171 / 1196 / 1381 still hold their `investment_id` after an arbitrary update. The parity
  golden master does not move.
- No deposit other than `INVESTOR_DEPOSIT` persists a `vatPlane`.

### Key Discoveries

- **Two different write semantics are needed.** `showsInvestment === false` currently means "null
  it", which is correct and tested for `OTHER` / `REGISTER_TRANSFER`
  (`validate-hook.test.ts:144-154`) but forbidden for the two deposit types. Owner's pick: a
  separate rule for the deposits — the incoming value is **ignored**, the stored one is left alone.
- **`transfer-constants.test.ts:146-155`** derives its predicate list from the module's exports — a
  new exported predicate fails that test until registered in `HELPERS`. Useful tripwire.
- **`transfer-actions.test.ts:212-221`** currently asserts that a create with `investment: 1` on
  both types **succeeds**, with `payload.create` mocked so the hook never runs. It is a false-green
  by construction and must be rewritten in the same commit.
- **`transfer-spec-table.test.ts:99-105`** guards `DEPOSIT_UI_TYPES` with a subset check only, so it
  stays green through the restore — its comment becomes false and must be corrected by hand.
- Both DB specs for deposits (`get-deposit-transactions.test.ts:47-51`,
  `deposit-transactions-where-scope.test.ts:47`) insert investment-bearing rows of these types by
  **raw SQL**, bypassing the hook. This is why enforcement must not live in a DB constraint.

## What We're NOT Doing

- Not touching rows 1171 / 1196 / 1381 — no unlink, no retype, no backfill (ruling 5).
- Not removing either type from `TransferTypeT`, `DEPOSIT_TYPES`, the label/colour map, or the type
  filter — both types stay fully visible and filterable.
- Not hardening the ADMIN/OWNER gate on `COMPANY_FUNDING` server-side (ruling 6: "client jest good
  enough").
- Not touching `SHEET_TRANSFER_TAB_TYPES` or `TRANSFERS_SUMMARY_TYPES` — the sheet column order is a
  frozen external contract and neither type is routed there.
- Not writing browser E2E for the deposit dialog in this change — filed to `e2e-backlog` (ruling 8).
- Not changing `/raporty` bucketing. Its Wpłaty + Bilans will resume rising with new „Inna wpłata"
  rows; that is correct company-wide and the owner has been told.

## Implementation Approach

One predicate carries the new rule and every consumer reads it. `INVESTMENT_TYPES` loses both
deposit types, which switches off the field in the edit form and the admin panel for free. A new
`ignoresInvestment(type)` predicate names the narrower set (the two deposit types) whose incoming
`investment` is dropped from the write payload rather than nulled — so a create can never plant one
and an update can never clear one. The deposit form stops submitting hidden values, and its
type-conditional JSX switches from a hardcoded type literal to the predicate.

## Critical Implementation Details

**Ordering inside `validate.ts`.** The new `ignoresInvestment` branch must sit **before** the
existing `if (!showsInvestment(type)) d.investment = null`, and must `return`/skip that assignment —
otherwise the wipe still fires and the grandfathered rows are lost. Deleting the key from `data`
(rather than assigning `null` or `undefined`) is what makes Payload leave the stored column
untouched on a partial update; assigning `undefined` is not equivalent for every adapter path, so
the delete is load-bearing, not stylistic.

---

## Phase 1: Constants and predicates

### Overview

Restore the type to the dialog, narrow the investment type set, and introduce the predicate that
names the new write rule. Update the two hand-written membership tables that pin these.

### Changes Required:

#### 1. Deposit dialog type list

**File**: `src/lib/constants/transfers.ts`

**Intent**: Return `OTHER_DEPOSIT` to `DEPOSIT_UI_TYPES` (the July removal was the wrong fix), and
rewrite the comment above it — it currently states the type was dropped per EX-536, which is no
longer true.

**Contract**: `DEPOSIT_UI_TYPES` keeps its documented Polish-label sort, so the array becomes
`['OTHER_DEPOSIT', 'INVESTOR_DEPOSIT', 'COMPANY_FUNDING']` — byte-identical to its pre-`72ddc5d7`
value.

#### 2. Investment type set and the new predicate

**File**: `src/lib/constants/transfers.ts`

**Intent**: Remove `'COMPANY_FUNDING'` and `'OTHER_DEPOSIT'` from `INVESTMENT_TYPES` so
`showsInvestment` is false for them everywhere (edit dialog, admin panel, and the deposit form once
Phase 3 switches to the predicate). Add a predicate naming the types whose incoming investment is
ignored on write rather than cleared, and document _why_ the distinction exists (grandfathered rows).

**Contract**: `ignoresInvestment(type: string): boolean`, backed by a module-level
`IGNORES_INVESTMENT_TYPES: TransferTypeT[] = ['COMPANY_FUNDING', 'OTHER_DEPOSIT']`, exported
alongside the other field-rule predicates in the same block (`:415-443`). It is a strict subset of
the complement of `showsInvestment` — assert that relationship rather than restating membership.

#### 3. Predicate membership tables

**File**: `src/__tests__/transfer-constants.test.ts`

**Intent**: Update the two pins that fail, and register the new predicate so the exhaustiveness
tripwire passes deliberately rather than by accident.

**Contract**: `:241-243` exact-array expectation gains `'OTHER_DEPOSIT'` in label-sorted position;
`showsInvestment.trueFor` (`:68-82`) drops both deposit types; a `ignoresInvestment` entry with its
own hand-written `trueFor: ['COMPANY_FUNDING', 'OTHER_DEPOSIT']` joins `HELPERS`. Keep these lists
hand-authored — deriving them from the source destroys the guard (`lessons.md`).

#### 4. Stale spec-table comment

**File**: `src/__tests__/transfer-spec-table.test.ts`

**Intent**: The subset assertion at `:99-105` stays green but its comment ("a strict subset by
design — „Inna wpłata" was dropped") is now false. Rewrite it to say why the subset is still not an
equality (the dialog list is label-sorted and role-filtered, the spec column is not).

### Success Criteria:

#### Automated Verification:

- Constants spec passes: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
- Spec-table consistency passes: `pnpm exec vitest run src/__tests__/transfer-spec-table.test.ts`

#### Manual Verification:

- „Inna wpłata" appears in the deposit dialog's type list, in Polish alphabetical order, for a
  MANAGER account.

---

## Phase 2: Validation hook

### Overview

Teach the server-side authority the new rule: drop an incoming investment for the two deposit types
without touching what is already stored.

### Changes Required:

#### 1. The ignore branch

**File**: `src/hooks/transfers/validate.ts`

**Intent**: Before the existing auto-clear, branch on `ignoresInvestment(type)`: remove `investment`
from the incoming data so neither a create nor an update can write one, and skip the `= null`
assignment so a stored value survives. The existing clear stays exactly as-is for every other type.

**Contract**: the mutation is `delete d.investment` (not `d.investment = null`), guarded by
`ignoresInvestment(type)`, placed above `if (!showsInvestment(type))`. Comment must name the reason:
three grandfathered rows predate the rule and the owner ruled they stay.

#### 2. Regression guard

**File**: `src/__tests__/hooks/transfers/investment-write-guard.test.ts` (new)

**Intent**: Pin both halves of the rule at the hook layer — the half that blocks and the half that
preserves. There is zero coverage of this axis today, in either direction.

**Contract**: three cases per deposit type — (a) create with `investment` set → returned data has no
investment; (b) update carrying `investment` → returned data has no `investment` **key**, so the
stored column is untouched (assert the key's absence, not a null value — a null is exactly the
failure being guarded against); (c) the existing `OTHER` / `REGISTER_TRANSFER` clear still yields
`null`. Mirror the harness shape of `src/__tests__/validate-hook.test.ts:144-154`; this spec is pure
unit (no DB), so it carries no `skipIf(!ENV_READY)` marker.

### Success Criteria:

#### Automated Verification:

- New guard passes: `pnpm exec vitest run src/__tests__/hooks/transfers/investment-write-guard.test.ts`
- Existing hook spec still passes: `pnpm exec vitest run src/__tests__/validate-hook.test.ts`

#### Manual Verification:

- Open one of the three legacy rows (id 1171) in the edit dialog, change only the description, save
  — the row still shows its investment in the transfers table afterwards.

---

## Phase 3: Deposit form and the write-side cleanup

### Overview

Stop the form submitting values it hides, and route its conditionals through the predicate instead
of a hardcoded type. Fix the two action tests that currently certify the forbidden shape.

### Changes Required:

#### 1. Type-conditional fields

**File**: `src/components/forms/deposit-form/deposit-form.tsx`

**Intent**: Replace the `currentType === 'INVESTOR_DEPOSIT'` literal gating the investment picker
(`:132`) with `showsInvestment(currentType)` — ruling 2's "one place, not JSX". Extend the
type-change listener (`:112-116`) to also reset `vatPlane`, and make `toData` omit both
`investment` and `vatPlane` when the current type does not carry them, so a hidden field can never
reach `payload.create` through the raw `...data` spread.

**Contract**: the investment condition reads `showsInvestment(currentType)`; the `vatPlane` field
keeps its own condition (it is an `INVESTOR_DEPOSIT`-only concern per EX-536, not an investment
concern, so it does **not** share the predicate); `toData` returns `investment: undefined` /
`vatPlane: undefined` for types that don't carry them.

#### 2. Action-layer specs that assert the forbidden shape

**File**: `src/__tests__/transfer-actions.test.ts`

**Intent**: `:212-221` sends `investment: 1` on both types and asserts success, with `payload.create`
mocked so the hook never runs — a false green that would survive the whole change. Rewrite so the
fixtures for these two types carry no investment, and add a case asserting that the payload handed
to `payload.create` contains no investment when one is supplied.

**Contract**: assert on the mock's received argument, not on the action's return value — a
`success: true` cannot distinguish "dropped" from "written".

### Success Criteria:

#### Automated Verification:

- Action specs pass: `pnpm exec vitest run src/__tests__/transfer-actions.test.ts`
- Schema specs unaffected: `pnpm exec vitest run src/__tests__/transfer-schema.test.ts`

#### Manual Verification:

- From `/inwestycje/<id>`, open the deposit dialog, pick „Inna wpłata", save — the created row shows
  „—" in the Inwestycja column, not the investment you were standing on.
- Switch the type from „Wpłata od inwestora" to „Zasilenie z konta firmowego" after picking an
  investment and netto/brutto — neither value is persisted on the saved row.

---

## Phase 4: Documentation and backlog

### Overview

Correct the prose that this change makes false, and file the deferred browser coverage.

### Changes Required:

#### 1. False invariant comment on the deposits query

**File**: `src/lib/db/sum-transfers.ts`

**Intent**: The comment at `:294-300` claims the deposit form hiding the picker is what keeps
`COMPANY_FUNDING` investment-free. That was never true (the form submitted it anyway) and is now
superseded by the hook rule. Rewrite it to point at the predicate as the authority, and record the
accepted discrepancy: three grandfathered rows still contribute to `totalIncome` on their
investments while this query omits them.

**Contract**: comment only — the `type = 'INVESTOR_DEPOSIT'` filter is unchanged.

#### 2. E2E backlog issue

**File**: none (Linear)

**Intent**: The deposit dialog has zero browser coverage — neither the role gate on „Zasilenie" nor
the investment-field condition. Per `AGENTS.md`, this slice owes an E2E or a filed deferral.

**Contract**: one issue in project "Wykonczymy", label `e2e-backlog`, naming both uncovered
behaviours and linking EX-557. Record its id in this plan's References section.

### Success Criteria:

#### Automated Verification:

- No phase-scoped automated check — this phase changes a comment and files an issue. Verified by the
  whole-tree gate only.

#### Manual Verification:

- The Linear issue exists, carries the `e2e-backlog` label, and its id is recorded here.

---

## Testing Strategy

### Unit Tests

- The new hook guard (Phase 2) is the primary regression asset: it pins that a create cannot plant
  an investment and that an update cannot clear one.
- The two hand-written membership tables in `transfer-constants.test.ts` remain the only guard over
  `showsInvestment` / `ignoresInvestment` — they must stay hand-authored.

### Integration Tests

- `pnpm test:integration` (5435 `db-test`) covers the DB-backed deposit specs. Both insert
  investment-bearing rows of these types by raw SQL and must stay green — that is the proof the
  guard sits above SQL and not inside it.
- `pnpm test:parity` is the over-reach detector: if the golden master moves on Łomianki Staszica
  20a/3, Szaserów 30b/32, or Meander 22/25, the guard has clipped stored data and Phase 2 is wrong.

### Manual Testing Steps

1. As MANAGER, open the deposit dialog from `/kasy` — „Inna wpłata" is offered, „Zasilenie z konta
   firmowego" is not.
2. From `/inwestycje/<id>`, add an „Inna wpłata" — the row lands with no investment.
3. Edit row 1171 (change the description only) — its investment survives.
4. Edit a `COMPANY_FUNDING` row from the transfers table — no investment picker is offered.

## Performance Considerations

None. The change adds one array membership test per write.

## Migration Notes

No schema change, no migration, no backfill. Existing rows are deliberately untouched.

## Whole-tree Gate

Run once, after Phase 4.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`
- DB-backed suite passes: `pnpm test:integration`
- Golden master unmoved: `pnpm test:parity`

## References

- Research: `context/changes/2026-08-12-ex-557-legacy-deposit-types/research.md`
- Change identity and owner rulings: `context/changes/2026-08-12-ex-557-legacy-deposit-types/change.md`
- Linear: EX-557; E2E backlog issue: _(recorded in Phase 4)_
- Regression origin: commit `72ddc5d7` (2026-07-21)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Constants and predicates

#### Automated

- [ ] 1.1 Constants spec passes: `pnpm exec vitest run src/__tests__/transfer-constants.test.ts`
- [ ] 1.2 Spec-table consistency passes: `pnpm exec vitest run src/__tests__/transfer-spec-table.test.ts`

### Phase 2: Validation hook

#### Automated

- [ ] 2.1 New guard passes: `pnpm exec vitest run src/__tests__/hooks/transfers/investment-write-guard.test.ts`
- [ ] 2.2 Existing hook spec still passes: `pnpm exec vitest run src/__tests__/validate-hook.test.ts`

### Phase 3: Deposit form and the write-side cleanup

#### Automated

- [ ] 3.1 Action specs pass: `pnpm exec vitest run src/__tests__/transfer-actions.test.ts`
- [ ] 3.2 Schema specs unaffected: `pnpm exec vitest run src/__tests__/transfer-schema.test.ts`

### Phase 4: Documentation and backlog

#### Automated

- [ ] 4.1 No phase-scoped automated check — verified by the whole-tree gate
