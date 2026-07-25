# Plan — narrow transfer-type spec table (EX-573)

Grounding: `research.md` (5 agents, every claim hand-verified; data proof against the local
prod restore). Decisions taken 2026-07-25 are recorded in `## Decisions` below and are **not**
open for re-litigation during implementation.

## Decisions

1. **Narrow table, not wide.** The table covers only axes where a missing decision is a
   **silently wrong number**. UI-ordering and sheet-column arrays stay hand-written literals,
   guarded by a consistency test rather than by the type system. Rationale: for a UI axis a
   missed type shows up immediately (a field or a select option is missing); paying
   compile-time cost there buys protection you don't need, and forces a ~20-column row that
   is unreadable across the axis you actually scan when debugging a number.
2. **`deriveFinancials` is in scope.** Removing its raw type literals matters more than the
   table itself — without it, a new type can carry a complete spec row and still fall into no
   bucket, silently. This is the back door the table alone leaves open.
3. **The CANCELLATION defect gets fixed**, not frozen. `needsSourceRegister('CANCELLATION')`
   returns `true` today; the table forces the question and the honest answer is `never`.
4. **`isExpensesTabType` and `canBeSettled` split in Phase 1**, reading two different columns,
   even though they return the same value for all 12 types today. They are two questions
   (sheet routing vs. "does the `settled` flag mean anything for this type") that currently
   share one answer — coincidental cohesion, which breaks silently. Netto then flips one cell
   (`settleable: false` with `expensesSheetTab: true`) instead of re-opening this refactor and
   re-walking all nine call sites. The consistency test **documents** that they agree today; it
   does not assert that they must.
5. **The safety net is a per-investment golden master over real prod data**, not a
   prod-vs-local comparison. No test may connect to Neon (`AGENTS.md`), and the risk here is
   not "environments disagree" — it is "the refactor moved a number". The `db-test` container
   on 5435 is a restore of the prod dump (100 investments / 3208 transactions / 257
   cancellations, verified 2026-07-25 — **fresher** than the 5433 dev DB), so freezing every
   figure for every investment there and re-asserting after each phase compares
   before-vs-after on the same real dataset. Strictly stronger than an environment diff.
   Runs in the existing `pnpm test:parity` harness, which `.husky/pre-push` already gates on.
6. **Netto (`netto-expense-type`) waits.** No schedule pressure, so this lands properly rather
   than minimally. The `billedAmount: 'amount' | 'netAmount'` column still belongs to the netto
   change (see `change.md`).

## Out of scope

- **EX-574** — the „Suma wybranych transakcji" over-report. Verified live defect, independent
  of this refactor, separately tracked with its own repro and test disposition.
- The five-axis field-rule matrix (`required` / `shown` / `auto-cleared` / `optional` /
  `exempt`) from `research.md` §4. Only the single CANCELLATION defect (decision 3) is touched;
  validation does **not** migrate into the table.
- **Any test that queries Neon prod.** `AGENTS.md` forbids it, and a suite that hit the live
  credential on every `pnpm test` would be a worse defect than the one being fixed. The prod
  figures enter the suite as **data** — via the `db:dump` → `db:import:test` restore — not as a
  connection.
- The nine remaining dormant disagreements (`research.md` §5 A, D–J). Zero bad rows in the DB;
  they are recorded there, not fixed here.

---

## Target shape

One file. `src/lib/constants/transfer-rules.ts` is deleted and its exports move back into
`src/lib/constants/transfers.ts`, dissolving the load-order cycle (`research.md` §3.8 — the
cycle is real, but the comment's stated mechanism is wrong: it is a TDZ `ReferenceError`, not
an `undefined` read).

```ts
export const TRANSFER_TYPES = [ /* 12 literals, Polish-alphabetical — UNCHANGED */ ] as const
export type TransferTypeT = (typeof TRANSFER_TYPES)[number]

type TransferSpecT = {
  label: string
  color: string
  deposit: boolean            // money direction: register sign + totalIncome
  expensesSheetTab: boolean   // owns a row on the kosztorys „Wydatki inwestycyjne" tab
  transfersSheetTab: boolean  // owns a row on the „transfery" tab
  settleable: boolean         // the `settled` flag is meaningful for this type
  financialBucket: 'materials' | 'income' | 'laborCosts' | 'payouts' | 'rabat' | 'loss' | 'none'
  sourceRegister: 'required' | 'never'
}

export const TRANSFER_TYPE_SPECS = { /* 12 rows */ } satisfies Record<TransferTypeT, TransferSpecT>
```

`TRANSFER_TYPES` stays a hand-written literal tuple — **not** `Object.keys(SPECS)`, which would
collapse `TransferTypeT` to `string` and silently break `z.enum`, every
`Record<TransferTypeT, …>` exhaustiveness check, and the `_AllTransferTypesCovered` assertion
in `src/collections/transfers.ts` (`research.md` §3.1). `satisfies Record<TransferTypeT, …>`
catches drift in both directions: a missing row is a missing-key error, an extra row is an
excess-property error.

### Why `expensesSheetTab` / `financialBucket: 'materials'` / `settleable` are three columns

Today one predicate (`canBeSettled`, aliasing `isExpensesTabType`) serves all three:

| use | call sites |
| --- | --- |
| sheet routing | `sheets-sync.ts:83,91,116`, `sync-sheet.ts:20`, `reference-data.ts:294` |
| financial bucketing | `investment-financials.ts:20,41,50` |
| `settled` field gate | `expense-form.tsx:331`, `validate.ts:109`, `actions/transfers.ts:112`, `collections/transfers.ts:250` |

The equality is **coincidental and three-way**. `INVESTMENT_EXPENSE_NET` splits it — which is
exactly the silent marża leak that motivated EX-573. Three columns make the split a declaration
instead of a thing to remember.

### What stays a literal (and why)

| array | why it can't be derived | how it's guarded |
| --- | --- | --- |
| `TRANSFERS_SUMMARY_TYPES` | order **is** Google Sheet columns I–N; `setupTab` rewrites the summary block verbatim on reset/relink, so a reorder silently rewrites live client spreadsheets | existing `lib/google/sheets.test.ts:308-346` + new order pin |
| `SHEET_TRANSFER_TAB_TYPES` | exports `SheetTransferTabTypeT`; a `.filter()` destroys the literal union | new consistency test: literal set === derived set |
| `EXPENSES_TAB_TYPES` | consumed at module load inside the Payload config graph (`sync-sheet.ts:20`) — must be an eager literal value | same consistency test |
| `TRANSACTION_TRANSFER_TYPES`, `DEPOSIT_UI_TYPES` | order is Polish-alphabetical, UI-facing | membership consistency test |
| Payload options (`collections/transfers.ts:16-32`) | deriving via `.map()` makes `_AllTransferTypesCovered` vacuously true — a **silent** loss of drift protection | left untouched |

`TRANSFER_TYPE_LABELS` and `TRANSFER_TYPE_COLORS` **do** fold into the table: they are already
`Record<TransferTypeT, string>`, so exhaustiveness is unchanged and two of the twelve lists
disappear for free.

---

## Phases

### Phase 0 — widen the characterization net (no production code changes)

The existing `src/__tests__/transfer-constants.test.ts` covers **7 of 15** predicates and
asserts nothing about `canBeSettled` or `isExpensesTabType`, which gate money math
(`research.md` §7). A test written after the rewrite proves nothing about behaviour
preservation, so the net is widened **first, against the current implementation**, and must be
green before Phase 1 begins.

- Extend the truth table to all 15 predicates × 12 types.
- Pin exact contents **and order** of `DEPOSIT_TYPES`, `DEPOSIT_UI_TYPES`,
  `TRANSACTION_TRANSFER_TYPES`, `SHEET_TRANSFER_TAB_TYPES`, `EXPENSES_TAB_TYPES`,
  `TRANSFERS_SUMMARY_TYPES`.
- Pin `TRANSFER_TYPE_LABELS` and `TRANSFER_TYPE_COLORS` per type.
- Pin `deriveFinancials` bucketing per (type × settled) — this is the net for Phase 2.
- Pin the `unknown ⇒ false` default for every predicate (`''`, `'UNKNOWN_TYPE'`).
- **Pin `needsSourceRegister('CANCELLATION') === true`** — documenting today's behaviour, so
  that Phase 3's flip is a visible, deliberate diff rather than a silent one.

Expected: all green on unchanged code.

### Phase 0b — the per-investment golden master (no production code changes)

The unit pins above prove the predicates didn't move. They do **not** prove that no displayed
figure moved — `deriveFinancials` (Phase 2) and the register sign (Phase 3) sit downstream of
them. This is the guard for the money itself, and it must be captured **before** Phase 1.

**Home:** `src/__tests__/financial-golden-master-db.test.ts`, next to
`investment-render-parity-db.test.ts` and gated identically (`describe.skipIf(!ENV_READY)`,
fails loudly if env is set but the DB is unreachable). Added to `test:parity`'s file list so
`.husky/pre-push` runs it.

**What is frozen** — `src/__tests__/fixtures/financial-golden-master.json`:

- **per investment** (all 100, keyed by id — **names are NOT written to the fixture**; they
  are real client names, so they are re-read from the DB only to label a failure line): every
  `InvestmentFinancialsT` field — `totalMaterialCosts`, `totalCorrections`, `totalIncome`,
  `totalLaborCosts`, `totalPayouts`, `totalRabat`, `totalLoss`, `totalSettled` — plus
  `categoryCosts` / `settledCategoryCosts` sorted by `categoryId`, plus the two derived
  figures the pages actually render: `calculateBalance` (bilans) and `calculateMargin` (marża).
- **per cash register** (all 32): the computed balance. Phase 3 is a register-drain defect, so
  the register axis cannot be left uncovered even though the user's focus is per-investment.
- All amounts rounded to 2dp (`round2`, as the existing parity test does) — the numbers are
  PLN, and float noise below a grosz is not a behaviour change.

**Failure output is per investment, not aggregate**: `#42 Kowalski · marża: expected 12 340,50
got 12 190,50` — one line per moved figure, collected and asserted as an array, so a single run
names every affected investment instead of stopping at the first.

**Dataset fingerprint — the part that keeps this from becoming noise.** The fixture is only
valid for the dataset it was taken from; a fresh `pnpm db:import:test` would move every row and
the test would fail wholesale, which reads as "the refactor broke everything" and gets the test
deleted. So the fixture carries a fingerprint — `COUNT(*)` plus a checksum over
`(id, type, amount, settled, investment_id, source_register_id, target_register_id, cancelled)`
of `transactions`. The test compares the fingerprint **first**:

- fingerprint differs → fail with _"dataset changed, regenerate the snapshot"_ — never reported
  as a figure drift;
- fingerprint matches, figures differ → **that is the real signal**.

**Regeneration:** `pnpm test:golden:update` (an env flag on the same spec that writes the
fixture instead of asserting). Regenerating is a deliberate, reviewable diff — a phase that
legitimately changes a figure shows exactly which investments moved and by how much.

Expected: green on unchanged code, and the fixture committed **before** Phase 1's first edit.

### Phase 1 — the table, derived predicates, cycle dissolved

- Add `TRANSFER_TYPE_SPECS` to `src/lib/constants/transfers.ts`.
- Derive the predicates from it; keep **every exported name and signature identical**,
  including the `unknown` vs `string` parameter split (`isExpensesTabType`, `canBeSettled`,
  `isSheetTransferTabType` take `unknown`; the rest take `string` — `collections/transfers.ts:250`
  relies on this).
- Preserve `isTransferType`-guarded `unknown ⇒ false` on every predicate.
- All derived values are **eager** — no lazy getters. `sync-sheet.ts:20` spreads two arrays at
  module load inside the Payload config graph; a lazy value yields `[]` there and **every
  transfer silently stops syncing to the sheet** (`research.md` §3.2).
- Delete `transfer-rules.ts`; the re-export barrel in `transfers.ts` disappears with it.
- Keep the file free of `server-only` / `payload` / React / `next/*` imports (Payload CLI graph).
- Add the consistency test: each retained literal array === the set derived from the table.
- Delete the false comment at `transfers.ts:82` (`SHEET_TRANSFER_TAB_TYPES` order is **not** the
  summary-block column order — that is `TRANSFERS_SUMMARY_TYPES`; the array is used only in
  `{ in: [...] }` wheres and `.includes()`, so it is order-free).

Gate: Phase 0's suite green, unchanged, **and the Phase 0b golden master byte-identical** —
this phase claims zero behaviour change, so a single moved figure across 100 investments
falsifies that claim outright. No consumer file is edited.

### Phase 2 — `deriveFinancials` reads the table

- Replace the five raw literals and the `DEPOSIT_TYPES.includes` in
  `src/lib/db/investment-financials.ts:41-50` with `financialBucket` lookups.
- `totalMaterialCosts` = `bucket === 'materials' && !settled`;
  `totalSettled` = `bucket === 'materials' && settled`.
- **Delete `totalCorrections`** — verified dead: computed at `investment-financials.ts:42`,
  declared at `types/investment-financials.ts:9`, zero-initialised at `queries/investments.ts:28`,
  and read nowhere.
- Also fold `deriveCategoryBreakdowns` (`:20`) onto the same column.

Gate: Phase 0's `deriveFinancials` pins green **and the golden master byte-identical across all
100 investments**. `totalCorrections` disappears from the snapshot shape — that key is dropped
from the fixture in the same commit, which is the visible record that a field was removed rather
than a number changed.

### Phase 3 — the CANCELLATION defect

- `sourceRegister: 'never'` on the CANCELLATION row; `needsSourceRegister` becomes a positive
  membership test derived from that column, matching every other predicate in the file
  (it is currently the only one written as an exclusion list, which is how CANCELLATION was
  missed).
- **Deliberate behaviour change**: flip the Phase 0 pin to `false`, with the reason in the test.
- Effects: the Payload admin stops rendering a „Kasa" picker on a cancellation row, closing the
  path where a register set there would hit the `ELSE -amount` arm at `sum-transfers.ts:48` and
  **silently drain that register**. Zero rows affected today (0/256 cancellations carry a
  register), so this is defence, not repair.
- `validate.ts:39`'s blanket CANCELLATION early return **stays**. The type is exempt from all
  cross-field validation; a mechanical table-driven rewrite that dropped it would break
  cancellation outright (`research.md` §5 C).

Gate: golden master byte-identical — **including all 32 register balances**. 0 of 257
cancellations carry a register today, so a moved register balance here would mean the change
did more than close the door.

---

## Progress

#### Automated

- [x] Phase 0 — widened characterization suite green on unchanged code
      (`transfer-constants.test.ts` 275 tests, all 15 predicates × 12 types + arrays + labels
      + colours + unknown-input; `derive-financials-bucketing.test.ts` 213 tests, the
      24-pair × 8-bucket matrix). Full unit suite: 1514 passed.
- [x] Phase 0b — golden master captured on unchanged code: 100 investments, 29 registers
      (only those carrying transactions), 36 workers; fingerprint 3208 transactions /
      `5df5464e…`. Fixture `src/__tests__/fixtures/financial-golden-master.json`.
- [x] Phase 0b — mutation-verified, not assumed: perturbing one `marza` by **0.01**, one
      `totalSettled`, and one register balance produced exactly three named drift lines;
      a wrong fingerprint produced the "regenerate" message instead of a drift report.
- [x] Phase 0b — `pnpm test:parity` green (now runs both DB specs);
      `pnpm test:golden:update` regenerates the fixture.
- [x] Phase 1 — characterization suite green **unchanged**; full unit suite 1527 passed
- [x] Phase 1 — golden master byte-identical (zero moved figures across 100 investments,
      29 registers, 36 workers)
- [x] Phase 1 — `pnpm typecheck` clean (the `readonly`-collapse near-miss in `lessons.md` broke
      15 call sites because `tsc` was never run — this gate is not optional)
- [x] Phase 1 — sheet-sync guard: both `SHEET_SYNCED_TYPES` inputs asserted non-empty at import
- [x] Phase 1 — `transfer-rules.ts` deleted, cycle dissolved, zero consumer files edited
      (the only importer was the re-export barrel in `transfers.ts`)
- [ ] Phase 2 — `deriveFinancials` pins green; golden master byte-identical apart from the
      deliberate `totalCorrections` key removal
- [ ] Phase 3 — `needsSourceRegister('CANCELLATION') === false`, reason recorded in the test
- [ ] Phase 3 — golden master byte-identical, register balances included
- [ ] `pnpm exec vitest run src/__tests__/lib/google/sheets.test.ts` green (summary-column order)

## Open risks

- **Sheet-column order** is the one failure mode with external blast radius: it rewrites live
  client spreadsheets on reset/relink, and no test failure would precede the damage in
  production. `TRANSFERS_SUMMARY_TYPES` stays literal specifically for this reason.
- **`_AllTransferTypesCovered`** in `collections/transfers.ts` must keep comparing two
  independently-authored lists. If it is ever fed from the table it becomes tautological and
  fails silently.
- **The golden master is coupled to a dataset it does not own.** `pnpm db:import:test` by anyone
  invalidates it. The fingerprint turns that from a false alarm into an explicit
  "regenerate" instruction, but it does mean the fixture must be regenerated (and the diff
  reviewed) after every test-DB refresh. That is the price of asserting on real prod figures
  instead of hand-built ones — and hand-built rows would not have caught EX-574 either.
- **The golden master proves preservation, not correctness.** It freezes what the app computes
  today, including anything it computes wrongly. EX-574 is exactly such a case and is
  deliberately outside this change — the snapshot will faithfully preserve it.
- The consistency test — not the type system — is what guards the retained literal arrays.
  That is a deliberate trade (see Decision 1), and it means **adding a type still requires
  visiting those five arrays**; the table only guarantees you are asked about the money axes.

## Merge order

Branched from `subcontractor-view-settlement-only` at `faecd048`. **That branch must land
first**, or `src/lib/constants/transfers.ts` conflicts.
