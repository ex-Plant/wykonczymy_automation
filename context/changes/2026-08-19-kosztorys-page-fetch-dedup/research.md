---
date: 2026-08-19T18:34:47+02:00
researcher: ex-Plant
git_commit: 7ed0ea4dc81612a4164888878480836c12990d7c
branch: fleet-manual-flags-and-service-type
repository: wykonczymy
topic: 'Redundant and duplicated server-side fetches on the kosztorys routes'
tags: [research, codebase, kosztorys, data-fetching, unstable_cache, perf]
status: complete
last_updated: 2026-08-19
last_updated_by: ex-Plant
---

# Research: Redundant and duplicated server-side fetches on the kosztorys routes

**Date**: 2026-08-19T18:34:47+02:00
**Researcher**: ex-Plant
**Git Commit**: `7ed0ea4dc81612a4164888878480836c12990d7c`
**Branch**: `fleet-manual-flags-and-service-type`
**Repository**: wykonczymy

## Research Question

`kosztorys_v2/page.tsx` fans out to nine parallel promises and an agent was about to add a tenth for
data the page already held. Which of the existing fetches are genuinely redundant, what else on the
kosztorys routes has the same shape, and what would removing them actually buy?

## Summary

**The perf premise this change started from is wrong, and the seed notes in `change.md` inherited the
error from a stale code comment.** `src/lib/db/kosztorys-tree.ts:16-22` states that Neon cost "scales
with the NUMBER of reads, not their size. So the lever is the count, and the floor is one (EX-597)."
EX-597's own record **retires that theory**
(`context/archive/2026-07-27-decouple-panel-write-refresh/change.md:214-218`): the parallel reads
measured 20/21/21/21/44 ms for a 45 ms total — *"total equals the slowest read, not their sum.
Collapsing them into one query could never win, and measured, it doesn't."* The comment was never
updated, and at least one later slice cites it verbatim as fact
(`context/archive/2026-08-12-ex-555-write-switch-labor-rabat/research.md:170-172`).

Consequence: **removing a redundant promise from a `Promise.all` buys approximately zero wall-clock.**
Every finding below therefore has to justify itself on correctness, invalidation surface, or code
shape — not on latency. Two do, comfortably. One is a genuine latent bug. Several are stale comments
that will keep producing wrong decisions until fixed.

The findings, ranked by what they're actually worth:

| # | Finding | Real basis | Verdict |
|---|---|---|---|
| 1 | `payoutsByWorker` is a `GROUP BY` over the rows `payoutTransactions` already returns | **correctness** — the Σ and its rows are two independent reads that can desync; exact EX-680 shape | fix |
| 2 | `SummaryExpensesTab` receives the materials aggregate and its row list from two different queries | **correctness** — the surviving instance of the EX-680 pattern | fix (rides along) |
| 3 | `requireInvestmentOr404` on `kosztorys_v2` is a `findByID` for a name `refData` already carries | code shape; violates its own docstring | fix |
| 4 | An `EMPLOYEE` reaching `/kosztorys_v2` races a throw against a redirect | **latent bug**, surfaced by #3 | fix with #3 |
| 5 | Seven `unstable_cache` calls nested inside `cachedPreviewKosztorysEditorData` | documented trap (`lessons.md:1443`); inner caches are dead | fix or document |
| 6 | Three stale/duplicated comments that are actively misleading planning | doc rot with a proven blast radius | fix |
| 7 | Legacy `/kosztorys` serializes the sheet lookup behind the guard | one serial round trip, genuinely serial | fix (cheap) |
| 8 | `fetchExpenseCategories` re-reads a table `refData` already loaded | duplicate SQL | **do not fix** — PII boundary is real |

## Detailed Findings

### 1. `payoutsByWorker` is derivable from `payoutTransactions` — and keeping both is the EX-680 bug

The two queries are character-for-character the same filter:

`src/lib/db/sum-transfers.ts:358-366`
```sql
SELECT worker_id, COALESCE(SUM(amount), 0) AS total
FROM transactions
WHERE type = 'PAYOUT' AND investment_id = ${investmentId} AND cancelled IS NOT TRUE
GROUP BY worker_id
```

`src/lib/db/sum-transfers.ts:391-398`
```sql
SELECT worker_id, date, amount, description
FROM transactions
WHERE type = 'PAYOUT' AND investment_id = ${investmentId} AND cancelled IS NOT TRUE
ORDER BY date DESC, id DESC
```

Same rows, same null-worker handling (`:369` vs `:401`, neither carries a `worker_id IS NOT NULL`
guard — deliberate, `:345-350`). Every consumer immediately re-keys the grouped result into a JS
`Map` and none depends on the grouping being done in SQL:

- `src/lib/kosztorys/subcontractor-summary.ts:87` — `payoutsTotal` is **already** a JS `reduce`
- `:88` — `new Map(payouts.map(row => [row.workerId, row]))`
- `:110`, `:113-117` — per-row `paid` and the name fallback
- `src/components/kosztorys/editor/tables/subcontractor-payouts-table.tsx:71-79` — name lookup only

No consumer needs a 0-total worker (a `GROUP BY` cannot emit one either; workers with no payout
arrive from `stages`/`byWorker` at `subcontractor-summary.ts:96-103`), and the null bucket survives a
JS grouping identically. `resolvePayoutWorkerNames` (`src/lib/kosztorys/payout-worker-names.ts`) is a
pure `map` that never filters, sums or reorders — it accepts a derived array unchanged.

**Float concern, checked:** Postgres `SUM(numeric)` is exact, a JS `reduce` over `Number()`-cast
values can drift ~1e-13. It cannot reach a cent, and every sign-sensitive comparison downstream is
already `roundToCents`-guarded (`subcontractor-summary.ts:112`, `:131`,
`subcontractor-worker-totals.tsx:70-72`) — the comment at `subcontractor-summary.ts:107-111` says
this guard exists *precisely because* `paid` is a raw Postgres SUM and `due` is a float product.

**Why it matters, and it isn't perf:** these are two independent `unstable_cache` entries
(`investment-transactions.ts:34` and `:48`), so a transfer mutation landing between them can hand the
panel a Σ that disagrees with the rows printed underneath it. That is exactly what EX-680 deleted for
wpłaty three days ago — `195f564f`, *"the total and the list could disagree, and on the share they
did"* — and the type contract already encodes the rule for deposits
(`src/lib/kosztorys/types.ts:171-174`: *"Required: the wpłaty TOTAL is summed from these rows"*).

**History:** the split was never a decision. The slice scoped the sum only
(`context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md:116`); the owner asked for the raw
list mid-slice (`:66-72`), it shipped as a second commit the same day (`7a88f088` → `23fade5f`), and
nobody revisited whether the sum could come from the list. The only recorded rationale is
`investment-transactions.ts:38` — *"Same cache contract as the per-worker sum above"*.

**Shape of the fix (per `lessons.md:1128`):** delete `payoutsByWorker` from `KosztorysEditorDataT`
rather than picking a winner, and derive inside `SubcontractorSummary` from `payoutTransactions`.
`fetchPayoutsByWorkerForInvestment` and `sumPayoutsByWorkerForInvestment` then have no production
caller and go too — note `src/__tests__/lib/db/sum-payouts-by-worker.test.ts:110` is their only other
caller and dies with them.

### 2. The materials aggregate still arrives beside its own row list

`SummaryExpensesTab` receives, at one component, both planes from **different queries**:

- `materials` (`{grossBase, netBilled}`) — `summary-panel-content.tsx:289`, from `fetchWholeInvestmentFinancials`
- `materialsBreakdown` / `settledBreakdown` — `:290`, `:295`, same source
- `materialTransactions` (the rows) — `:299`, from `fetchMaterialTransactionsForInvestment`

and the aggregate **gates the rows' own section**: `summary-expenses-tab.tsx:112` hides the breakdown
on `materials.grossBase + materials.netBilled === 0`, while `:135` independently shows the list on
`listedTransactions.length > 0`. Different queries, different type filters
(`EXPENSES_TAB_TYPES` at `investment-transactions.ts:84-93` vs whatever `deriveFinancials` sums), and
in preview only the row list is filtered by `clientVisibleExpenseRows` (`:73-75`).

This is the live survivor of the pattern EX-680 was opened to kill. It is a bigger and riskier change
than #1 — the aggregate is a three-surface figure policed by `pnpm test:parity` — but the owner ruled
it **rides along** in this change rather than waiting for its own slice: closing half the pattern on
one page would leave the other half looking deliberate.

`depositTransactions` is clean by contrast: `bucketDepositsByPlane(depositTransactions)` returns the
total and the rows from one source (`summary-panel-content.tsx:199-205`, `deposit-planes.ts:6-9`).
`SubcontractorSummary` is *not* an instance — `subcontractorDue` is genuinely the kosztorys plane
against the transactions plane, and `subcontractor-summary.ts:79-81` states the headline is
deliberately not Σ rows.

### 3. `requireInvestmentOr404` on `kosztorys_v2` buys nothing it doesn't already hold

`page.tsx:46` costs one `payload.findByID` (`investments.ts:81-99`, `overrideAccess: true`,
`unstable_cache` keyed `['investment', id]`). It returns three things:

| what | already available |
|---|---|
| `investment.name` | `refData.investments` — `page.tsx:80` already reaches into that array for `hasSheet` |
| `user.role` (for the `financials` gate, `:91`) | `requireAuth(MANAGEMENT_ROLES)` — a `cache()`d JWT decode (`get-current-user-jwt.ts:31`), no DB; `getKosztorysTree` already calls it (`kosztorys.ts:17`) |
| existence → `notFound()` | `refData.investments.find(...)` — the query is unfiltered (`reference-data.ts:62-70`), so any existing investment is in it |

The `investments` collection has **no relationship fields**, so the `findByID` is a single-table read
— cheap in SQL, but still a cache entry and a round trip.

Its own docstring forbids this exact use (`investments.ts:47-49`): *"Pages that already hold the
investment from another fetch (e.g. the detail page's refData) don't use this — it would double the
load."* `inwestycje/[id]/page.tsx:49-57` follows it; this page doesn't.

**The redundancy was introduced, not inherited.** `9dbe3b11` (2026-07-17, EX-445) added the guard to a
page that then had *no* `fetchReferenceData` — it replaced a hand-rolled `getInvestment` + `notFound()`
and was not redundant. `3889c48b` (2026-07-19, "per-category Materiały breakdown") added
`fetchReferenceData` two days later and nobody noticed the guard had become a duplicate read.
`3fc35958` (2026-07-21, EX-554) then folded the guard *into* the `Promise.all` "so its latency
overlaps the group rather than gating it" — which is why it has stayed invisible ever since.

**Precedent is three days old:** `dca9e111` (2026-08-19) made `hasSheet` ride `refData.investments`
— *"no second trip for one boolean"*. The same array carries the name. EX-608 already made this exact
argument for the crumb (`investments.ts:65-72`,
`context/changes/2026-08-18-linear-done-audit/done-issues-audit.md:585-589`) and left the page guard
on the same route still paying for it.

**`requireInvestmentOr404` itself stays** — `src/app/(share)/podglad-inwestora/[id]/page.tsx:11`
carries its whole auth gate through it (the `(share)` layout reads no session), and the legacy
`/kosztorys` page uses it too. Only this page's call goes.

### 4. Latent bug: an `EMPLOYEE` on `/kosztorys_v2` races a throw against a redirect

Both guards sit in the same `Promise.all` and disagree on failure mode:

- `getKosztorysTree` → `requireAuth` fails → **`throw new Error(session.error)`** (`kosztorys.ts:18`)
- `requireInvestmentOr404` → `requireAuth` fails → **`redirect('/zaloguj')`** (`investments.ts:53-54`)

`Promise.all` rejects with whichever settles first. `treePromise` is created first (`page.tsx:30`) and
does less work before throwing, so an `EMPLOYEE` most likely lands on `src/app/(frontend)/error.tsx`
rather than the login page — and `lessons.md:1336` records that a render throw in a streamed RSC page
still answers **200**, so nothing external would flag it.

Removing #3 makes the outcome deterministic *in the wrong direction* (always the throw). The fix has
to be explicit: call `requireAuth(MANAGEMENT_ROLES)` on the page and `redirect('/zaloguj')` before the
fan-out, matching `inwestycje/[id]/page.tsx:29-31`. This is why #3 is not a pure deletion.

### 5. The share path nests seven `unstable_cache` calls inside another one

`cachedPreviewKosztorysEditorData` (`preview-kosztorys.ts:94-98`) wraps
`buildPreviewKosztorysEditorData`, whose body calls seven already-cached fetchers:

| inner cached call | reached at |
|---|---|
| `fetchFilteredByType` | `preview-kosztorys.ts:62` |
| `fetchCategoryBreakdowns` | `:62` |
| `fetchExpenseCategories` | `:63` |
| `findTransfersRaw` | `:64` → `investment-transactions.ts:84` |
| `fetchExpenseCategories` (second nesting of the same entry) | `:64` → `investment-transactions.ts:94` |
| `fetchAllMedia` | `:64` → `investment-transactions.ts:97` |
| `fetchDepositTransactionsForInvestment` | `:65` |

`lessons.md:1443-1445`: *"an `unstable_cache` nested inside another bypasses the cache entirely — the
inner call just runs."* So on the share path those seven caches are dead weight: an outer miss runs
every query raw. `buildKosztorysTree` is the one nested call that is *correctly* uncached — that is
what the guard/body split at `kosztorys.ts:23-26` exists for.

Two adjacent observations on the same wrapper: its key is `['preview-kosztorys-editor-data']` with **no
investment id and no version suffix**, while it is a shape-sensitive payload an unauthenticated client
renders directly — `lessons.md:1010` and `reference-data.ts:148-151` both say a shape change needs a
key bump because a tag only marks an entry stale and it still serves the old payload once.

This is the largest *mechanical* finding in the sweep, and it is not on `kosztorys_v2` at all.

### 6. Three comments that are actively producing wrong decisions

- **`src/lib/db/kosztorys-tree.ts:16-22`** — asserts the round-trip-count theory EX-597 retired
  (`change.md:214-218`). It has already been cited as fact by a later slice's research
  (`2026-08-12-ex-555-write-switch-labor-rabat/research.md:170-172`) and it seeded this change's own
  wrong premise. `lessons.md:733` is exactly this failure mode.
- **`src/lib/queries/whole-investment-financials.ts:50`** — names
  `src/scripts/audit-investment-parity.ts` as what "polices that agreement". **That file was deleted**
  (`2026-08-12-ex-555-write-switch-labor-rabat/plan.md:328` — "(deleted)"); `src/scripts/` does not
  contain it. The live guard is `src/__tests__/investment-render-parity-db.test.ts:207`
  (`pnpm test:parity`).
- **`src/lib/queries/investments.ts:63-72`** — the EX-608 rationale is written **twice**, two
  paraphrases stacked back to back.

### 7. Legacy `/kosztorys`: one genuinely serial round trip

`src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:17-22` awaits `requireInvestmentOr404` and only
then calls `getInvestmentSheetId` — so unlike `kosztorys_v2`, this one really does serialize. Two
sequential round trips where a `Promise.all` would do one. The sheet-id read itself is justified:
`refData` projects only the boolean `has_sheet` (`reference-data.ts:66`), deliberately, so as not to
leak the sheet id into the cache. The page could still take its name from `refData` — but it has no
other reason to load `refData`, so the cheaper fix here is just to parallelize.

### 8. `fetchExpenseCategories` duplicating `refData.expenseCategories` — leave it

`fetchMaterialTransactionsForInvestment` calls `fetchExpenseCategories()`
(`investment-transactions.ts:94`) while the page holds the same table in `refData`
(`page.tsx:72`). It is a genuine duplicate query on this page — and it must stay. The fetcher is
shared with the unauthenticated `/k/[token]` share path (`preview-kosztorys.ts:64`), and
`fetchReferenceData` selects every user's `name, role, email` (`reference-data.ts:71-74`) plus every
investment's `address, phone, email, notes` (`:62-70`). Swapping it in would not itself emit PII, but
`preview-kosztorys.ts:25-30` states the share payload ships with **no projection or stripping** — the
full dataset would then sit one careless destructure from an unauthenticated render. The comment is a
live constraint, not documentation rot.

## What removing any of this actually costs and buys

Measured locally against the docker DB (5433), worst-case investment (id 26, 365 transactions, 115
payouts — the largest in the restored prod dump):

- `sumPayoutsByWorkerForInvestment`: **0.865 ms** execution
- `getPayoutTransactionsForInvestment`: **0.247 ms** execution

The SQL is free. Per EX-597, so is a parallel round trip. Per `lessons.md:674`, a local bench cannot
see Neon's network cost anyway, so these numbers only establish that **no query-level fix exists here**
— the same conclusion EX-597 reached about `sumAllRegisterBalances`.

The one mechanism nobody has measured: on a fully cold render this page issues roughly **14–15
concurrent statements** (tree 1, financials 2, refData 5, payouts 1, payout rows 1, deposits 1,
materials 2–3, `getInvestment` 1) against a connection pool whose `max` is **10** — `payload.config.ts:58`
passes only a `connectionString`, `@payloadcms/db-vercel-postgres/dist/connect.js:23` constructs
`new VercelPool(poolOptions)`, and `pg-pool/index.js:89` defaults `max` to 10. So the tail of the
fan-out queues behind the first wave. Whether that costs anything real is **unverified** — EX-597
specifically disproved pool contention as the explanation for the one slow read it was blamed for
(`change.md:216`). Cold renders are also common on this route: all six transaction-sourced entries
share `CACHE_TAGS.transfers`, so **every transfer mutation anywhere busts them simultaneously.**

Per `lessons.md:1186` — a finding that names a mechanism without a magnitude is a question — the pool
observation stays a **question**, and no part of this change should be justified by it. Findings 1–4
stand on correctness and code shape alone.

## Code References

- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:28-67` — the nine-promise fan-out
- `src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx:17-22` — the serial legacy pair
- `src/lib/queries/investments.ts:47-49` — the docstring this page violates
- `src/lib/queries/investments.ts:63-72` — EX-608 rationale, written twice
- `src/lib/db/sum-transfers.ts:351-410` — the two payout queries, same WHERE
- `src/lib/kosztorys/subcontractor-summary.ts:87-131` — every consumer of the grouped payouts
- `src/lib/kosztorys/types.ts:165-176` — the editor data contract; deposits already carry the EX-680 rule
- `src/lib/queries/preview-kosztorys.ts:52-98` — the share assembly and its outer cache
- `src/lib/db/kosztorys-tree.ts:16-22` — the retired round-trip theory, still in the code
- `src/lib/queries/whole-investment-financials.ts:50` — names a deleted script as the parity guard
- `src/components/kosztorys/editor/tabs/summary-expenses-tab.tsx:112-135` — aggregate gating its own row list
- `src/payload.config.ts:58` + `pg-pool/index.js:89` — pool `max` resolves to 10

## Architecture Insights

- **Parallel fan-out hides cost, it doesn't remove it.** `3fc35958` folded the guard into the
  `Promise.all` precisely so its latency wouldn't show. That worked — and is why a duplicate read
  survived five months of slices touching this file.
- **This codebase's real fetch invariant is single-source, not few-source.** EX-680 and the
  `depositTransactions` contract both encode "derive the figure from the rows"; nothing in the record
  supports "fetch fewer things". Findings 1 and 2 are the remaining violations of the rule that exists.
- **A guarded/unguarded function pair is the seam that lets a share path exist** (`kosztorys.ts:23-26`).
  Anything moved *into* `buildKosztorysTree` becomes unauthenticated-reachable, and `requireAuth`
  reads cookies so it can never move inside an `unstable_cache` callback
  (`preview-kosztorys.ts:92-93`). That bounds every restructuring option here.
- **Auth failure mode is not standardized**: DAL guards throw, page guards redirect, `getInvestmentName`
  returns null. Mixing two of them in one `Promise.all` is finding #4.

## Historical Context (from prior changes)

- `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:56-63, 186-224` — EX-597: what
  was measured, what was retired, and the warm/cold method rule. It never looked at `kosztorys_v2`;
  commit `7d1a0492` instrumented the fan-out the same day and left it.
- `context/archive/2026-08-12-wplaty-jedno-zrodlo/` + `195f564f` — EX-680, the direct precedent for
  finding 1, argued on correctness.
- `context/archive/2026-07-21-podsumowanie-podwykonawcow/change.md:66-72, 116` — how the payout
  sum/list split happened (owner request mid-slice, never revisited).
- `context/archive/2026-07-27-decouple-panel-write-refresh/review-gate.md:176` — where EX-608 was
  filed; `context/changes/2026-08-18-linear-done-audit/done-issues-audit.md:585-589` — its rationale.
- `context/archive/2026-08-18-marza-prognoza-rzeczywista/review-gate.md:37-46` — the same
  "second full scan of the same rows" finding on the investments listing, **unticketed** (Linear was
  at its free-issue limit).
- `context/archive/2026-08-11-kosztorys-importer/review-gate.md:50` — a fix once declined because it
  needed "a fresh `getInvestmentSheetId` round-trip on every kosztorys page load"; `dca9e111` later
  solved that by riding `hasSheet` on refData.

## Related Research

- `context/archive/2026-08-12-ex-555-write-switch-labor-rabat/research.md:170-172` — cites the stale
  `kosztorys-tree.ts` numbers verbatim; a consumer of finding 6.
- `context/foundation/lessons.md:1128` (total + list from one query), `:1186` (measure before
  planning), `:674` (Neon bimodal), `:1443` (nested `unstable_cache`), `:733` (stale doc read as
  foundation) — all four priors bit here.

## Decisions (owner, 2026-08-19)

- **Base branch: `staging`.** The folder was created on
  `fleet-manual-flags-and-service-type`; implementation branches off `staging`.
- **Finding 2 rides along.** The materials aggregate and its row list are fixed in the same change as
  finding 1, not deferred to a separate slice — one change closes the EX-680 pattern on this page
  rather than leaving half of it standing. It carries the extra obligation of `pnpm test:parity`
  staying green, since the materiały figure is the three-surface one.

## Open Questions

1. **Does the 15-concurrent-vs-pool-10 queueing cost anything on Neon?** Unmeasured, and EX-597's
   method rule says it cannot be answered by a local bench or a small sample. The instrument already
   exists: the `[PERF] kosztorys_v2/<id> … fan-out` line at `page.tsx:64-67`. Answering it is not a
   prerequisite for findings 1-4, and no part of this change is justified by it.
2. **Should the seven dead nested caches on the share path be removed, or the outer one?** Removing
   the outer wrapper restores seven working caches with finer invalidation; removing the inner ones
   keeps one coarse entry. Not obvious, and it is a share-path correctness question, not a cleanup.
3. `src/app/(share)/podglad-inwestora/[id]/page.tsx:11` uses `requireInvestmentOr404` but discards
   `investment` entirely - only `investmentId` is read. The `findByID` there is a pure existence
   check. Worth folding into this change or leaving alone?
