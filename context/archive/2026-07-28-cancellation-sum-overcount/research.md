---
date: 2026-07-28T18:47:52+0200
researcher: Claude (3 parallel agents + hand verification of the two load-bearing claims)
git_commit: 4d074f353f988b739621676b8c76933b5bb702aa
branch: staging
repository: wykonczymy
topic: 'EX-574 — „Suma wybranych transakcji" counts CANCELLATION rows; blast radius of the stripCancelledFilters fix'
tags: [research, transfers, stripCancelledFilters, sum-transfers, where-to-sql, EX-574]
status: complete
last_updated: 2026-07-28
last_updated_by: Claude
---

# Research: EX-574 — the cancellation overcount and what the fix touches

## Research Question

The diagnosis is already done and verified against real prod data —
`context/archive/2026-07-25-transfer-type-spec-table/research.md` §1 (EX-573 research) proves the
defect with per-month figures. **This pass answers the fix questions instead:**

1. Does the SQL translator even support `not_in`, or would the proposed fix silently no-op?
2. What else moves if `stripCancelledFilters` stops stripping `type`?
3. Where does the red test go, and what should it assert?

## Summary

**The fix is smaller than the issue proposes and has no regression surface.**

`where-to-sql.ts:78-81` already translates `not_in` → `column NOT IN (…)`. Nothing downstream needs
touching. The whole defect is one upstream function deliberately discarding a filter the SQL layer
would have honoured.

`stripCancelledFilters` does not need a `not_in` branch bolted onto its `in` branch — it needs to
stop stripping `type` at all. There is **no case** where the stats query wants the type filter gone:
audit mode's `in` is already kept, a user's `?type=` `in` is already kept, and the default `not_in`
is exactly what is missing. The function collapses to stripping `cancelled` only.

**Regression surface: none.** Every other consumer of the affected query buckets strictly by type
(`financialBucketOf`), and `CANCELLATION` carries `financialBucket: 'none'`, so it already
contributes 0 to marża, bilans, income, materials, payouts and every category breakdown. The one
number that moves is the tile — from wrong to right.

**Fix option (a) from the Linear issue is unsafe** and must be recorded as rejected: filtering
`CANCELLATION` out of the `reduce` in `transfer-table-server.tsx:55` would zero the tile in audit
mode, where the list is exclusively `CANCELLATION` rows.

Two things the Linear issue does not state, both found here:

- **The Pulpit is affected too** (`manager-dashboard.tsx:37-41`), which puts the defect in front of
  **MANAGER**, not just ADMIN/OWNER as the issue's „Zasięg" section implies.
- **A second, independent live defect on the same tile**: the amount-range filter's upper bound is
  silently dropped in every stats query (§4). Bigger relative error than the cancellation bug on
  that path.

## Detailed Findings

### 1. The translator supports `not_in` — verified by hand

`src/lib/db/where-to-sql.ts:78-81`:

```ts
if ('not_in' in cond && Array.isArray(cond.not_in)) {
  const vals = cond.not_in.map(escapeValue).join(', ')
  parts.push(`${column} NOT IN (${vals})`)
}
```

`type` maps to the plain column `type` (`:10`); the `::text` cast exists only in the SELECT list
(`sum-transfers.ts:265`, `:416`), never in the WHERE — so `{ type: { not_in: ['CANCELLATION'] } }`
emits `AND type NOT IN ('CANCELLATION')`, matching the shape already asserted for the `in` case
(`sum-transfers.test.ts:252`).

- **No cast needed, and adding one would hurt.** Postgres coerces the unknown-typed literal to the
  enum on both sides; `type::text NOT IN (…)` would defeat the enum index.
- **`NOT IN` null-safety is not a concern**: `transactions.type` is `NOT NULL`
  (`src/migrations/20260211_213603.ts:12`).
- **Escaping**: `escapeValue` (`where-to-sql.ts:99-103`) doubles single quotes; values are already
  whitelisted against `TRANSFER_TYPES` upstream (`transfer-filters.ts:88`). Second layer, as the
  file's own comment states.
- **Both stats functions share this translator** — `sumFilteredByType` (`sum-transfers.ts:401-434`)
  and `sumCategoryByTypeSettled` (`:253-285`). One fix lands on both.
- `isNoResultsSentinel` (`where-to-sql.ts:4-7`) inspects `where.id` only and short-circuits before
  any SQL is built. Orthogonal to `type`.

### 2. Blast radius — every consumer of the stripped Where

Four call sites, no others in `src`, `e2e` or `scripts`:

| #   | site                           | fed to                                                        |
| --- | ------------------------------ | ------------------------------------------------------------- |
| 1   | `raporty/page.tsx:33`          | `fetchFilteredByType` + `fetchCategoryBreakdowns`             |
| 2   | `inwestycje/[id]/page.tsx:46`  | both (Where also carries `investment: { equals: id }`, `:43`) |
| 3   | `pracownicy/[id]/page.tsx:32`  | `fetchFilteredByType` only                                    |
| 4   | `transfer-table-server.tsx:27` | `fetchFilteredByType` → `totalFilteredAmount`                 |

Site 4 is reached from **five** Where producers via `TransfersSection` → `TransferTableServer`:
`raporty:79`, `inwestycje/[id]:129`, `pracownicy/[id]:68`, `kasa/[id]:74`, and
**`manager-dashboard.tsx:37`** — the last of which the Linear issue's scope section misses.

**Two consumption shapes, only one at risk:**

- **Bucket-based (safe).** `deriveFinancials` (`investment-financials.ts:70-106`) routes every row
  through `financialBucketOf(r.type)`; `CANCELLATION.financialBucket === 'none'`
  (`constants/transfers.ts:88-101`) and `'none'` matches no bucket in `sumBucket`/`sumRows`
  (`:59-63`, `:77-102`). Same for `deriveCategoryBreakdowns` (`:33-57`), which additionally would
  need a non-null `expense_category_id` on the cancellation. **CANCELLATION already contributes 0 —
  excluding it changes nothing.**
- **Raw-row (the bug).** `transfer-table-server.tsx:55` reduces the whole distribution with no type
  filter. This is the only figure that moves. (`pracownicy/[id]/page.tsx:54` also reads the raw
  distribution but selects `type === 'PAYOUT'` explicitly — unaffected.)

**The two builders that skip `stripCancelledFilters`** — `kosztorys_v2/page.tsx:29` and
`client-kosztorys.ts:39`, both `{ investment: { equals: id } }` — can match CANCELLATION rows, but
consume only `deriveFinancials`/`deriveCategoryBreakdowns` outputs. Unaffected by the bug **and** by
the fix (they never call the function).

**`unstable_cache` key churn** (`transfer-totals.ts:19`, `:30` — `JSON.stringify(where)`): keys shift
in _all_ modes, not just the fixed one. Today `result.type = type` is re-appended after the `...rest`
spread so `type` serializes last; after the fix it keeps its original insertion position. Semantically
identical, one cold-cache cycle, no correctness impact — but it means "nothing changed elsewhere"
won't show up as a cache hit during verification.

### 3. The two cancelled-visibility modes are provably untouched

| mode                           | Where today                                               | after fix                            |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------ |
| default                        | `type not_in`, `cancelled not_equals` → **both stripped** | `type not_in` survives → **the fix** |
| `?type=…`                      | `type in [...]` → kept (`:188-190`)                       | kept                                 |
| `?showCancelled=1`             | neither key is set (`:92`, `:97`)                         | nothing to strip → identical         |
| `?cancelledTransactionAudit=1` | `type in ['CANCELLATION']` → kept                         | kept → identical                     |

This is what kills **fix option (a)**: in audit mode the tile is _supposed_ to sum CANCELLATION rows,
because that is the entire list. Filtering the type out of the reduce would print 0,00 zł there.

**Two residual mismatches the fix does NOT address** — record them so they aren't later mistaken for
a failed fix: in `showCancelled` mode the tile omits the cancelled originals the list shows, and in
audit mode it omits the originals spliced in at `transfer-table-server.tsx:34-43`. Both stem from the
hardcoded `cancelled IS NOT TRUE` in SQL, are pre-existing, and are orthogonal.

### 4. Second live defect found: the amount filter's upper bound is silently dropped

Not part of EX-574; found while auditing the translator, verified by hand.

`buildTransferFilters` emits a half-open numeric range for a decimal amount search
(`transfer-filters.ts:158-162`):

```ts
{ amount: { greater_than_equal: low, less_than: high } }
```

`where-to-sql.ts:82-92` handles `greater_than_equal`, `less_than_equal` and `like` — **there is no
`less_than` branch.** An unmatched operator is not an error: `buildFieldCondition` is a flat chain of
`if ('op' in cond)` and simply falls through (`:68-92`), so the ceiling vanishes and the stats query
runs `amount >= low` unbounded. It **fails open** — the dangerous direction.

`amount` is in `ENTITY_FILTER_KEYS` (`transfer-filters.tsx:26-36`), so an amount search alone renders
the tile. Searching „18,00" therefore lists transactions in `[18, 18.01)` while the tile above sums
**every transaction ≥ 18 zł**. On a real dataset that dwarfs the cancellation error.

Same function, same tile, three-line fix (`less_than` → `<`), same test file. Whether it rides along
or gets its own issue is a plan decision, not a research one — but it is not "out of scope" merely
for being a different operator.

Related, benign: `id` is deliberately skipped (`where-to-sql.ts:41`), and `settled` has no
`FIELD_TO_COLUMN` entry but is never produced by `buildTransferFilters`.

### 5. Test surface

**Nothing covers `stripCancelledFilters` — zero test references repo-wide.** The input side is
already pinned: both `build-transfer-filters.test.ts:90-96` and
`transactions-report-filters.test.ts:33-39` assert the default
`{ type: { not_in: ['CANCELLATION'] }, cancelled: { not_equals: true } }`. Only the strip is untested.

**Placement.** Per the AGENTS.md mirror rule, a spec for `src/lib/queries/transfer-filters.ts` goes at
`src/__tests__/lib/queries/transfer-filters.test.ts` (the directory already exists). The two existing
`buildTransferFilters` suites sit at the top level because they predate the convention — don't add to
them, don't move them as part of this change.

**Harness to reuse** — `sum-transfers.test.ts:15-25` (fake payload capturing `db.drizzle.execute`)
plus `extractSql` (`:240`). Negative-assertion precedent at `:309-317`.

**Assert the emitted SQL, not the returned `Where`.** Asserting that `stripCancelledFilters` returns
an object still holding `not_in` pins the intermediate shape and would stay green if the translator
ever dropped the operator. Drive the real composition instead:

```ts
const urlFilters = buildTransferFilters({ from: '2024-01-01', to: '2024-12-31' }, { id: 1 })
await sumFilteredByType(fakePayload, stripCancelledFilters(urlFilters))
expect(extractSql(mockExecute.mock.calls[0][0])).toContain("type NOT IN ('CANCELLATION')")
```

Three cases give the envelope: **default** (excludes CANCELLATION — red today), **`showCancelled=1`**
(no exclusion — the user asked to see them), **`?type=PAYOUT,OTHER`** (emits `type IN (…)`, proving the
fix doesn't clobber a user-selected inclusion filter). A date assertion alongside guards against
over-stripping.

**No existing gate catches this.** `investment-render-parity-db.test.ts:72-74` builds its own
`{ investment: { equals: id } }` and never touches either function; both sides of its comparison
would inherit the same contamination, so it stays green. `financial-golden-master-db.test.ts`
snapshots per-investment figures, not the `/raporty` tile path. `e2e/` has six specs, none touching
`/raporty` or the tile. The new spec is pure (no DB) and runs on the `pnpm test` pre-push leg;
`test:integration` discovers only specs carrying `skipIf(!ENV_READY)`.

## Code References

- `src/lib/queries/transfer-filters.ts:183-192` — `stripCancelledFilters`, the defect
- `src/lib/queries/transfer-filters.ts:92-99` — the two default exclusions it discards
- `src/lib/queries/transfer-filters.ts:158-162` — the amount range that emits the unsupported `less_than`
- `src/lib/db/where-to-sql.ts:78-81` — `not_in` support (the fix's downstream, already correct)
- `src/lib/db/where-to-sql.ts:82-92` — the operator chain missing `less_than`
- `src/lib/db/sum-transfers.ts:401-434` — `sumFilteredByType`, hardcoded `cancelled IS NOT TRUE` at `:420`
- `src/components/transfers/transfer-table-server.tsx:53-56` — the untyped reduce
- `src/components/transfers/transfer-filters.tsx:26-36,220-226` — `ENTITY_FILTER_KEYS` and the tile
- `src/components/dashboard/manager-dashboard.tsx:37-41` — the affected surface the issue misses
- `src/lib/db/investment-financials.ts:70-106` — bucket routing that makes every other figure immune
- `src/lib/constants/transfers.ts:88-101` — `CANCELLATION.financialBucket: 'none'`

## Architecture Insights

- **A filter stripped upstream is invisible downstream.** `sumFilteredByType` re-adds
  `cancelled IS NOT TRUE` in SQL, which reads like it restores what `stripCancelledFilters` removed —
  but it only restores one of the two exclusions. The comment at `raporty/page.tsx:32` („Stats ignore
  cancelled toggle — SQL already excludes cancelled") states the intent correctly and is exactly the
  sentence that hides the gap: `cancelled` and `type = CANCELLATION` are two different concepts
  (archive research §9), and only one is handled in SQL.
- **`buildFieldCondition` fails open.** An operator it doesn't recognise widens the result set with no
  warning (§4). Any new operator in `buildTransferFilters` is a silent correctness risk in the stats
  plane. Matches the lessons.md entry on static findings needing a read of the actual edge — here the
  edge is a fall-through, not a throw.
- **Two planes, one rule** (lessons.md: "an invariant enforced in two planes needs a test on the
  BRIDGE"). The list plane (Payload `find`) and the stats plane (raw SQL) enforce the same visibility
  rule through different mechanisms. The bug is precisely a bridge failure, and the test above is a
  bridge test — it runs the real builder through the real strip into the real translator.

## Historical Context (from prior changes)

- `context/archive/2026-07-25-transfer-type-spec-table/research.md` §1 — the verified diagnosis,
  per-month prod figures, the +71% March case, and the two-URL repro. §9 defines the
  `type = 'CANCELLATION'` vs `cancelled = true` split this bug lives on. §6 notes CANCELLATION is
  referenced by raw literal in 13 sites — relevant if EX-573's spec table lands later.
- `context/foundation/lessons.md` — "Before filing 'X isn't validated', follow X to its READ path"
  (applied: the fix's no-op surfaces were traced to their consumers, not assumed);
  "A static-audit finding is a candidate, not a verdict" (applied: both agent claims re-read by hand).

## Related Research

- EX-573 (`Harden transfer types: one spec table`) — independent; this fix does not wait on it, and
  the spec table would later absorb the CANCELLATION literal used here.

## Open Questions

1. **Does the `less_than` gap (§4) ride along or get its own issue?** Same file, same tile, same test
   file, ~3 lines. Argues for riding along; a separate bug argues for its own regression guard commit.
2. **Do the `showCancelled` residual mismatches (§3) get recorded anywhere?** They are pre-existing
   and arguably correct-by-design, but nothing says so in the code today.
3. **Is an E2E owed?** The risk is browser-level (a number rendered above a list it disagrees with),
   `/raporty` has zero E2E coverage, and the unit bridge test covers the mechanism. Likely the
   `e2e-backlog` label rather than an authored spec.
