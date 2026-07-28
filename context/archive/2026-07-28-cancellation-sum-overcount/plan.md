# Plan — „Suma wybranych transakcji" equals the rows the list is showing

**Change**: `cancellation-sum-overcount` · **Linear**: EX-574 (both defects folded in) · **Base**: `staging` @ `4d074f35`

## Goal

One acceptance sentence, both defects: **the tile equals the sum of the rows the list is showing.**
Where that is deliberately not true (audit / `showCancelled` views), the tile says so on screen instead
of lying silently.

## Current State

- `buildTransferFilters` emits two independent default exclusions — `type: { not_in: ['CANCELLATION'] }`
  (`transfer-filters.ts:93`) and `cancelled: { not_equals: true }` (`:98`).
- `stripCancelledFilters` (`:183-192`) drops **both**, then re-adds only the `in` form. The stats SQL
  (`sum-transfers.ts:420`) hardcodes `cancelled IS NOT TRUE` and nothing else — so the CANCELLATION
  stub rows survive into the tile at +1× their amount.
- `buildSqlConditions` (`where-to-sql.ts:60-97`) is a flat `if ('op' in cond)` chain with **no `else`**.
  `less_than` — emitted by the amount range at `transfer-filters.ts:161` — matches no branch and is
  discarded without a sound. The filter fails **open**: `amount >= 500` unbounded.
- `not_in` **is** supported (`where-to-sql.ts:78-81`), so fix 1 needs no translator work.

## Decisions

| Decision                 | Choice                                                                        | Why                                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix shape, defect 1      | `stripCancelledFilters` stops stripping `type` entirely                       | Audit's `in` and a user's `?type=` `in` are already kept, and the `not_in` is the correct exclusion for the tile too. There is no caller that wants the type filter gone — the whole `if ('in' in type)` branch is dead weight around a bug.                                |
| Issue (a) from EX-574    | **Rejected**                                                                  | Filtering CANCELLATION out of the `reduce` in `transfer-table-server.tsx` prints 0,00 zł in `?cancelledTransactionAudit=1`, where the list is exclusively CANCELLATION rows.                                                                                                |
| Fix shape, defect 2      | Add the missing comparison branches **and** throw on an unrecognised operator | Every `Where` reaching this translator is built in-repo by `buildTransferFilters` — the operator set is closed, so a throw can only fire on a coding change, at test time. It replaces a failure mode (silently wrong money on screen) with one that is impossible to miss. |
| `showCancelled` residual | Not fixed — surfaced in the UI                                                | The SQL's hardcoded `cancelled IS NOT TRUE` means the tile omits cancelled originals the list shows. Changing it changes what the tile _means_ in an audit view — a product call, not a bugfix. Instead the tile states its own scope on screen.                            |
| E2E                      | Deferred to the `e2e-backlog` Linear label                                    | The bridge spec runs the real `buildTransferFilters → stripCancelledFilters → buildSqlConditions` composition, so the mechanism is guarded. `/raporty` has zero Playwright coverage today; standing that up is its own task.                                                |
| Tracking                 | One issue, EX-574, extended to cover both defects                             | Owner's call.                                                                                                                                                                                                                                                               |

## Phases

### Phase 1 — Defect 1: the tile counts anulowania

Test-driven debugging. Red first.

1. New spec `src/__tests__/lib/queries/transfer-filters.test.ts` (mirror rule; the two existing
   `buildTransferFilters` suites at the top level predate the convention — don't extend or move them).
   Reuse the fake-payload harness + `extractSql` from `src/__tests__/sum-transfers.test.ts:15-25,240`.
   **Assert the emitted SQL, not the returned `Where`** — a Where-shape assertion stays green if the
   translator drops the operator, which is exactly how defect 2 hid.
   - default view (`{}` params) → SQL contains `type NOT IN ('CANCELLATION')` — **red today**
   - `?showCancelled=1` → SQL contains no `type` condition
   - `?type=PAYOUT,OTHER` → SQL contains `type IN ('PAYOUT', 'OTHER')` (green today, pins the strip)
   - `?cancelledTransactionAudit=1` → SQL contains `type IN ('CANCELLATION')` (green today, guards
     against a fix that zeroes the audit tile)
2. `src/lib/queries/transfer-filters.ts` — collapse the body to `const { cancelled, ...rest } = where;
return rest`. Update the doc comment to say it strips the `cancelled` condition only, and why
   (the stats SQL owns that one).
3. Green. Verify in the browser against `repro.md` §Defect 1: `2026-03` reads **4 202 513,34 zł**.

Commit: `fix(EX-574): the transaction sum stops counting the anulowania that undo it`

### Phase 2 — Defect 2: the amount filter's ceiling never reaches SQL

1. Extend the new spec: `?amount=500,00` → SQL contains `amount >= 500` **and** `amount < 500.01`
   — the second is red today.
2. `src/lib/db/where-to-sql.ts` — add `less_than` and `greater_than` branches; after the chain, throw
   on any key in `cond` that no branch consumed. Update the doc comment's operator list (it currently
   claims to list what's handled and is already wrong).
3. A spec case asserting the throw on an unknown operator, so the guard itself is covered.
4. Green. Verify against `repro.md` §Defect 2: `?amount=500,00` → tile **10 000,00 zł**, 20 rows.

Commit: `fix(EX-574): an unknown filter operator stops vanishing on the way to SQL`

### Phase 3 — Say what the tile counts

The two views where tile ≠ list by design get a one-line on-screen scope note.

- `src/components/transfers/transfer-filters.tsx:220-226` — the component already reads
  `searchParams`, so no prop threading. When `showCancelled=1` or `cancelledTransactionAudit=1`,
  pass `StatButton`'s existing `tooltip` prop explaining that the sum skips anulowane transakcje
  even though the list shows them.
- Polish UI copy, English code. Keep it to one sentence.
- No test — a static label on a `!==` branch.

Commit: `feat(EX-574): the sum tile states its scope where it differs from the list`

### Phase 4 — Close out

- Extend EX-574's description to cover defect 2 (title stays about anulowania; add a „Drugi defekt"
  section with the `?amount=500,00` figures), then → Done.
- File the `/raporty` E2E as a new issue in project **Wykonczymy**, label `e2e-backlog`, carrying the
  acceptance sentence and the two repro URLs. → **EX-627**.
- Update `change.md` → `status: implemented`; note the Pulpit blast radius in the EX-574 comment.

## Files Touched

| File                                                 | Change                                                |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `src/lib/queries/transfer-filters.ts`                | `stripCancelledFilters` stops stripping `type`        |
| `src/lib/db/where-to-sql.ts`                         | `less_than` / `greater_than` + unknown-operator throw |
| `src/components/transfers/transfer-filters.tsx`      | scope tooltip on the tile in cancelled views          |
| `src/__tests__/lib/queries/transfer-filters.test.ts` | **new** — the bridge spec                             |

## Risks

- **Zero regression surface on the money figures.** Every other consumer routes through
  `financialBucketOf`, and `CANCELLATION.financialBucket === 'none'`
  (`src/lib/constants/transfers.ts:88-101`) — those already contribute 0 to marża / bilans / income /
  materials / payouts / breakdowns. Only the tile moves, and only from wrong to right.
- **`unstable_cache` key churn.** The stripped `Where` changes shape, so every cached stats entry
  misses once. One cold cycle, all modes. Harmless.
- **The throw in Phase 2 is the one behaviour-changing call.** It converts a silent wrong number into
  a 500 on `/raporty`. Accepted deliberately: the operator set is closed and in-repo, and the spec
  covers every operator `buildTransferFilters` can emit — a throw here is a test failure, not an
  incident.
- **Five affected surfaces**, incl. the **Pulpit** (`manager-dashboard.tsx:37-41`), which EX-574's
  „Zasięg" misses — the audience includes MANAGER. `/inwestycje/[id]`, `/kasa/[id]`,
  `/pracownicy/[id]` are immune (their relational column survives the strip; anulowania have it NULL).

## Progress

#### Automated

- [x] Phase 1 — bridge spec red → `stripCancelledFilters` fix → green — dc2bf98b
- [x] Phase 2 — amount-ceiling case red → translator fix + guard → green — 5ed00e78
- [x] Phase 3 — scope tooltip — 27444def
- [x] Phase 4 — EX-574 updated + `in review`, E2E filed as EX-627 (`e2e-backlog`)
