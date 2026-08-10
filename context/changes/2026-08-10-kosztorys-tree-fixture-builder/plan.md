# Shared kosztorys tree fixture builder — Implementation Plan

## Overview

Replace five hand-rolled `beforeAll` fixture blocks with one declarative builder that takes a tree
spec and returns the created ids. Behaviour of every spec stays identical; only how its fixture is
spelled changes.

## Current State Analysis

Six DB-gated specs create kosztorys rows. Five of them do it the same way — a run of
`payload.create({ collection: 'kosztorys-sections' | 'kosztorys-items' | 'kosztorys-stages', …,
context: { skipRevalidation: true } })` — and differ only in which fields they vary:

| Spec                                                          | Fixture             | Shape                                                                       |
| ------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------- |
| `lib/kosztorys/serialize-restore-roundtrip.test.ts:93-268`    | inline `beforeAll`  | 3 sections / 6 items / 3 stages / 2 progress — the column-coverage extremes |
| `lib/kosztorys/serialize-apply-preset.test.ts:96-180`         | `buildSourceTree()` | 2 sections / 3 items / 2 stages / 2 progress                                |
| `lib/kosztorys/restore-rollback.test.ts:44-78`                | inline `beforeAll`  | 1 section / 1 item / 2 stages / 1 progress                                  |
| `lib/kosztorys/restore-duplicate-display-order.test.ts:38-69` | inline `beforeAll`  | 2 sections / 3 items, all tied on `display_order` 0                         |
| `lib/db/kosztorys-tree.db.test.ts:25-78`                      | `seed()`            | 2 sections / 1 item / 1 stage / 1 progress, ×2 investments                  |
| `lib/kosztorys/append-preset-sections.test.ts:41-76`          | `addSection()`      | 1 section + 1 item, called repeatedly                                       |

The sixth, `lib/kosztorys/display-order.test.ts`, builds its tree through the **actions**
(`addSectionAction` / `addItemAction`) because the action mechanics are what it asserts. It is not a
fixture and is out of scope.

### Key discoveries

- **`src/__tests__/helpers/kosztorys-tree.ts` — the filename the issue asks for — is already taken**
  by an unrelated helper: `makeTree` / `baseItem`, the in-memory `KosztorysTreeT` envelope used by
  seven pure-calculation specs. Nothing to merge; different layer, different concern. The new file
  needs its own name.
- **`buildKosztorysTree` is a production function** (it prints the `[PERF] buildKosztorysTree …` line
  in these very specs' output), so the builder can't take that name either.
- **Children cascade off the investment.** Four specs already rely on `deleteTestInvestment` alone to
  clean up sections/items/stages/progress. `kosztorys-tree.db.test.ts` additionally hand-maintains a
  `cleanup` array of every created row — redundant with the cascade its neighbours prove.
- **`stage_progress` has a Payload collection** (`stage-progress`), used by `kosztorys-tree.db.test`.
  The other three specs write it with raw `INSERT INTO stage_progress` and therefore have to take a
  `db` handle. Going through the collection everywhere drops `db` from the builder's signature.
- `restore-deleted-worker.test.ts` matches the pattern but is **untracked work in the shared tree
  belonging to another session** — excluded, see What We're NOT Doing.

## Desired End State

A spec declares its tree as a literal and gets ids back:

```ts
const { sectionIds, itemIds, stageIds } = await createKosztorysTree(payload, investmentId, {
  sections: [
    { name: 'Sekcja A', items: [{ description: 'Malowanie', plannedQty: 10, clientPrice: 100 }] },
  ],
  stages: [{ label: 'Etap 1' }, { label: null }],
  progress: [{ item: 0, stage: 0, qtyDone: 4 }],
})
```

Every migrated spec keeps the exact rows it creates today, and the six files stay green.

## What We're NOT Doing

- **Not touching `restore-deleted-worker.test.ts`.** It is untracked in the shared working tree — a
  parallel session's in-flight file. Rewriting its `beforeAll` would collide with whoever is writing
  it. It gets migrated in a follow-up once it lands.
- Not touching `display-order.test.ts` — its tree comes from the actions under test, not from a
  fixture.
- Not merging with `helpers/kosztorys-tree.ts` (`makeTree`). One builds DB rows, the other builds an
  in-memory `KosztorysTreeT` for pure calculation; a shared abstraction over both would fit neither.
- Not changing what any spec asserts, and not widening any spec's column coverage. Unifying coverage
  is the builder's _eventual_ payoff, but doing it in the same change would make a red test
  ambiguous — refactor first, then extend deliberately.

## Implementation Approach

**Positional addressing, no keys.** The result mirrors the spec literal: `sectionIds[i]` for the i-th
section, `itemIds` flattened in declaration order, `stageIds[i]` for the i-th stage. `progress` refers
to items and stages by those same indices. Keys would be more robust to reordering, but every current
call site wants "the first item" — a key registry would be ceremony no spec needs, and an index that
mirrors the literal directly above it is readable.

**Defaults only where the field is boilerplate, never where it's scenario.** `displayOrder` defaults
to the array index, a stage's `ordinal` to `index + 1`, `discountValue` to `0`, `hiddenInExport` to
`false` — the values every spec repeats without asserting. Scenario fields (`description`, `unit`,
`plannedQty`, `clientPrice`) default to the empty/null form so a spec spells out only what it is
actually testing, the same discipline `helpers/investment.ts` and `baseItem` already follow.

**One write path.** All four row kinds go through `payload.create` with
`context: { skipRevalidation: true }` — including progress, via the `stage-progress` collection.
That's what makes the builder need only `payload`, dropping the `db` handle three specs pass today
purely to run one raw INSERT.

## Critical Implementation Details

**A tie on `display_order` must stay expressible.** `restore-duplicate-display-order` deliberately
puts two sections and two items on the same `display_order`; the index default must be overridable
per row, not computed and forced.

**Nulls must survive as nulls.** The roundtrip spec's coverage section sets `description: null`,
`unit: null`, `wToolsOverrideType: null` on purpose. The builder must pass an explicitly-provided
`null` straight through and only fall back to a default when the key is _absent_ — `??` on the value,
never `||`, and no `{ ...defaults, ...spec }` shortcut that a present-but-undefined key defeats.

---

## Phase 1: The builder

### Changes Required

#### 1. The fixture builder

**File**: `src/__tests__/helpers/kosztorys-db-tree.ts` (new)

**Intent**: One declarative description of a kosztorys tree → the rows, created in order, with their
ids handed back positionally.

**Contract**:

```ts
export async function createKosztorysTree(
  payload: Payload,
  investmentId: number,
  spec: TreeSpecT,
): Promise<CreatedTreeT>
```

- `spec.sections[]` — `name` required; `displayOrder` defaults to the index; `color` and `items[]`
  optional.
- `spec.sections[].items[]` — every field optional; `displayOrder` defaults to the index within its
  section.
- `spec.stages[]` — every field optional; `ordinal` defaults to `index + 1`.
- `spec.progress[]` — `{ item, stage, qtyDone }`, where `item` indexes the flattened item list and
  `stage` indexes `spec.stages`.
- Returns `{ sectionIds, itemIds, stageIds }` — `itemIds` flattened in declaration order.

#### 2. Migrate the five fixtures

**Files**: `serialize-restore-roundtrip.test.ts`, `serialize-apply-preset.test.ts`,
`restore-rollback.test.ts`, `restore-duplicate-display-order.test.ts`,
`lib/db/kosztorys-tree.db.test.ts`, `append-preset-sections.test.ts`

**Intent**: Each `beforeAll` / local fixture helper becomes one `createKosztorysTree` call.

**Contract**: byte-identical rows to what each spec creates today. Where a spec captured an id from a
`payload.create` result (`item1.id`, `stage1.id`, `section.id`), it reads the corresponding entry off
the returned arrays. `kosztorys-tree.db.test.ts` additionally drops its now-redundant `cleanup` array
— the investment cascade covers it, as it already does for its neighbours. Comments that explain
_why_ a fixture is shaped the way it is (column coverage, the deliberate tie, out-of-order insertion)
move with the literal; they are the part that carries knowledge.

### Success Criteria

#### Automated Verification:

- The six specs stay green against the 5435 test DB (baseline: 6 files / 22 tests)
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- The rest of the unit suite passes: `pnpm exec vitest run`

#### Manual Verification:

None — this is test infrastructure with no runtime surface.

---

## Testing Strategy

Per the issue's disposition (`test: no automated test`), the builder gets no spec of its own: the six
specs it serves _are_ its regression guard, and they assert persisted DB state, so a builder that
wrote a wrong row fails them loudly. A spec asserting the builder produced the rows the builder was
asked for would only restate the builder.

The discipline that makes that guard real: **run the six green before touching anything** (done —
22 tests), then keep the rows identical, so any red after the refactor is unambiguously the builder.

## Performance Considerations

None. Same number of `payload.create` calls; the three raw `INSERT INTO stage_progress` statements
become collection creates in fixture setup.

## Migration Notes

None — no schema, data, or persisted-shape change.

## References

- Issue: EX-635 (surfaced by the EX-430 review gate)
- Sibling helper it sits next to: `src/__tests__/helpers/investment.ts`
- Name collision to avoid: `src/__tests__/helpers/kosztorys-tree.ts` (`makeTree` / `baseItem`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The builder

#### Automated

- [x] 1.1 Baseline: the six specs green before any edit (6 files / 22 tests @ 5435)
- [x] 1.2 The six specs green after the refactor (6 files / 22 tests — identical)
- [x] 1.3 Type checking passes: `pnpm typecheck`
- [x] 1.4 Linting passes: `pnpm lint` (0 errors, 80 pre-existing warnings, none in the touched files)
- [x] 1.5 The rest of the unit suite passes: `pnpm exec vitest run` (1923 passed, 31 files skipped — the DB specs)

Net: 444 fixture lines deleted, 207 written back, +134 for the builder — the six specs shed ~237
lines of `payload.create` boilerplate.
